# calendar_service.py — Google Calendar OAuth 2.0 + appointment management

import logging
import re
import zoneinfo
from datetime import date, datetime, timedelta
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from app.config import settings
from app.database import supabase

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TIMEZONE_STR = "America/Chicago"
TIMEZONE = zoneinfo.ZoneInfo(TIMEZONE_STR)
BOOKING_START_HOUR = 9   # 9 AM
BOOKING_END_HOUR = 17    # 5 PM
SLOT_MINUTES = 30

_service = None  # Cached Google Calendar service


# ---------------------------------------------------------------------------
# OAuth service
# ---------------------------------------------------------------------------

def get_service():
    """Return a cached Google Calendar service, re-authing as needed."""
    global _service
    if _service is not None:
        return _service

    creds = None
    token_path = Path(settings.google_token_file)
    creds_path = Path(settings.google_credentials_file)

    if not creds_path.exists():
        raise FileNotFoundError(f"credentials.json not found at {creds_path}")

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(str(token_path), "w", encoding="utf-8") as f:
            f.write(creds.to_json())
        logger.info("[OK] calendar_service: OAuth token saved to %s", token_path)

    _service = build("calendar", "v3", credentials=creds)
    logger.info("[OK] calendar_service: Google Calendar service ready")
    return _service


# ---------------------------------------------------------------------------
# Time helpers (Windows safe — no strftime %-I)
# ---------------------------------------------------------------------------

def _format_time(dt: datetime) -> str:
    """Format datetime to 12-hour time string (e.g. '9:00 AM', '1:30 PM')."""
    hour = dt.hour
    minute = dt.minute
    if hour == 0:
        h, period = 12, "AM"
    elif hour < 12:
        h, period = hour, "AM"
    elif hour == 12:
        h, period = 12, "PM"
    else:
        h, period = hour - 12, "PM"
    return f"{h}:{minute:02d} {period}"


def _format_date(d: date) -> str:
    """Format date to readable string (e.g. 'Monday, March 25')."""
    return d.strftime("%A, %B %d").replace(" 0", " ")


# ---------------------------------------------------------------------------
# Date/time parsing
# ---------------------------------------------------------------------------

def _parse_date(date_str: str) -> date | None:
    """Parse a natural-language or ISO date string into a date object."""
    today = datetime.now(TIMEZONE).date()
    s = date_str.strip().lower()

    if s in ("today", "now"):
        return today
    if s == "tomorrow":
        return today + timedelta(days=1)

    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, day in enumerate(day_names):
        if s == day or s == f"next {day}":
            days_ahead = (i - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # Same day = go to next week
            return today + timedelta(days=days_ahead)

    # ISO and common formats
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%B %d, %Y",
        "%B %d %Y",
        "%b %d, %Y",
        "%b %d %Y",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str.strip(), fmt).date()
            # Correct past years (LLM sometimes sends wrong year)
            if parsed < today and (today - parsed).days > 30:
                parsed = parsed.replace(year=today.year)
                if parsed < today:
                    parsed = parsed.replace(year=today.year + 1)
            return parsed
        except ValueError:
            continue

    return None


def _parse_time(time_str: str) -> tuple[int, int] | None:
    """Parse a time string into (hour, minute) in 24-hour format."""
    s = time_str.strip().upper()

    # 12-hour with AM/PM: "9 AM", "9:30 AM", "1:00 PM"
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$", s)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        if m.group(3) == "PM" and hour != 12:
            hour += 12
        elif m.group(3) == "AM" and hour == 12:
            hour = 0
        return (hour, minute)

    # 24-hour: "14:00", "09:30"
    m = re.match(r"^(\d{1,2}):(\d{2})$", s)
    if m:
        return (int(m.group(1)), int(m.group(2)))

    # Plain integer hour: "9", "14"
    m = re.match(r"^(\d{1,2})$", s)
    if m:
        hour = int(m.group(1))
        if 0 <= hour <= 23:
            return (hour, 0)

    return None


# ---------------------------------------------------------------------------
# check_availability
# ---------------------------------------------------------------------------

def check_availability(date_str: str) -> str:
    """Return available 30-minute slots for a given date."""
    parsed = _parse_date(date_str)
    if parsed is None:
        return f"I couldn't understand the date '{date_str}'. Please try again with a date like 'Monday' or 'March 28'."

    today = datetime.now(TIMEZONE).date()
    if parsed < today:
        return "That date is in the past. Please choose a future date."

    # Only offer weekday slots (Mon-Fri)
    if parsed.weekday() >= 5:
        return f"{_format_date(parsed)} is a weekend. We're available Monday through Friday, 9 AM to 5 PM."

    try:
        service = get_service()
    except Exception as e:
        logger.error("[ERROR] calendar_service: get_service failed: %s", str(e))
        return "I'm having trouble connecting to the calendar right now. Please call back shortly."

    # Build day window in timezone
    day_start = datetime(parsed.year, parsed.month, parsed.day, BOOKING_START_HOUR, 0, tzinfo=TIMEZONE)
    day_end = datetime(parsed.year, parsed.month, parsed.day, BOOKING_END_HOUR, 0, tzinfo=TIMEZONE)

    try:
        fb_result = service.freebusy().query(body={
            "timeMin": day_start.isoformat(),
            "timeMax": day_end.isoformat(),
            "timeZone": TIMEZONE_STR,
            "items": [{"id": settings.google_calendar_id}],
        }).execute()
        busy = fb_result["calendars"][settings.google_calendar_id]["busy"]
    except Exception as e:
        logger.error("[ERROR] calendar_service: freebusy failed: %s", str(e))
        return "I couldn't check availability right now. Please try again."

    # Generate 30-min slots
    now = datetime.now(TIMEZONE)
    slots = []
    cursor = day_start
    while cursor < day_end:
        slot_end = cursor + timedelta(minutes=SLOT_MINUTES)

        # Skip past slots if checking today
        if parsed == today and cursor <= now:
            cursor = slot_end
            continue

        # Check overlap with busy periods
        busy_overlap = False
        for b in busy:
            b_start = datetime.fromisoformat(b["start"]).astimezone(TIMEZONE)
            b_end = datetime.fromisoformat(b["end"]).astimezone(TIMEZONE)
            if cursor < b_end and slot_end > b_start:
                busy_overlap = True
                break

        if not busy_overlap:
            slots.append(_format_time(cursor))

        cursor = slot_end

    if not slots:
        return f"There are no available slots on {_format_date(parsed)}. Would you like to try another day?"

    # Return up to 3 slots at a time (per VAPI assistant rules)
    shown = slots[:3]
    result = f"On {_format_date(parsed)}, I have openings at: {', '.join(shown)}."
    if len(slots) > 3:
        result += f" I have {len(slots) - 3} more slots available — would you like to hear more?"
    return result


# ---------------------------------------------------------------------------
# book_appointment
# ---------------------------------------------------------------------------

def book_appointment(
    caller_phone: str,
    caller_name: str,
    date_str: str,
    time_str: str,
    notes: str = "",
) -> str:
    """Create a Google Calendar event and save to Supabase."""
    parsed_date = _parse_date(date_str)
    if parsed_date is None:
        return f"I couldn't understand the date '{date_str}'. Can you try again?"

    parsed_time = _parse_time(time_str)
    if parsed_time is None:
        return f"I couldn't understand the time '{time_str}'. Can you try again?"

    hour, minute = parsed_time
    now = datetime.now(TIMEZONE)

    start_dt = datetime(parsed_date.year, parsed_date.month, parsed_date.day, hour, minute, tzinfo=TIMEZONE)
    end_dt = start_dt + timedelta(minutes=SLOT_MINUTES)

    if start_dt <= now:
        return "That time has already passed. Please choose a future time."

    if hour < BOOKING_START_HOUR or hour >= BOOKING_END_HOUR:
        return f"We only take bookings between 9 AM and 5 PM. Please choose a time within those hours."

    if parsed_date.weekday() >= 5:
        return "We're only available Monday through Friday. Please choose a weekday."

    # Duplicate booking guard
    if caller_phone:
        existing = _find_upcoming_appointments(caller_phone)
        if existing:
            appt = existing[0]
            return (
                f"It looks like you already have an appointment on "
                f"{appt.get('start_time', 'a future date')}. "
                f"Would you like to reschedule that one instead?"
            )

    try:
        service = get_service()
    except Exception as e:
        logger.error("[ERROR] calendar_service: get_service failed: %s", str(e))
        return "I'm having trouble connecting to the calendar. Please try again shortly."

    title = f"Appointment — {caller_name}" if caller_name else "Appointment"
    description_parts = []
    if caller_phone:
        description_parts.append(f"Phone: {caller_phone}")
    if notes:
        description_parts.append(f"Notes: {notes}")

    event_body = {
        "summary": title,
        "description": "\n".join(description_parts),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": TIMEZONE_STR},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": TIMEZONE_STR},
    }

    try:
        event = service.events().insert(
            calendarId=settings.google_calendar_id,
            body=event_body,
        ).execute()
        event_id = event.get("id", "")
        logger.info("[OK] calendar_service: event created id=%s", event_id)
    except Exception as e:
        logger.error("[ERROR] calendar_service: event insert failed: %s", str(e))
        return "I ran into a problem creating the appointment. Please try again."

    # Save to Supabase
    if supabase:
        try:
            supabase.table("appointments").insert({
                "google_event_id": event_id,
                "caller_phone": caller_phone or None,
                "caller_name": caller_name or None,
                "start_time": start_dt.isoformat(),
                "end_time": end_dt.isoformat(),
                "status": "booked",
            }).execute()
        except Exception as e:
            logger.warning("[WARN] calendar_service: Supabase insert failed: %s", str(e))

    date_display = _format_date(parsed_date)
    time_display = _format_time(start_dt)
    return (
        f"You're all set! I've booked your appointment for {date_display} at {time_display}. "
        f"You'll receive a confirmation shortly."
    )


# ---------------------------------------------------------------------------
# reschedule_appointment
# ---------------------------------------------------------------------------

def reschedule_appointment(
    caller_phone: str,
    new_date_str: str,
    new_time_str: str,
    current_date_str: str = "",
    current_time_str: str = "",
) -> str:
    """Move an existing appointment to a new date/time."""
    upcoming = _find_upcoming_appointments(caller_phone)
    if not upcoming:
        return "I don't see any upcoming appointments for this number. Would you like to book a new one?"

    # Match by current date/time if provided, otherwise use first upcoming
    appointment = upcoming[0]
    if current_date_str and current_time_str:
        matched = _find_matching_appointment(upcoming, current_date_str, current_time_str)
        if matched:
            appointment = matched

    google_event_id = appointment.get("google_event_id", "")
    appt_id = appointment.get("id")

    # Parse new date/time
    new_date = _parse_date(new_date_str)
    if new_date is None:
        return f"I couldn't understand the new date '{new_date_str}'. Please try again."

    new_time = _parse_time(new_time_str)
    if new_time is None:
        return f"I couldn't understand the new time '{new_time_str}'. Please try again."

    hour, minute = new_time
    now = datetime.now(TIMEZONE)
    new_start = datetime(new_date.year, new_date.month, new_date.day, hour, minute, tzinfo=TIMEZONE)
    new_end = new_start + timedelta(minutes=SLOT_MINUTES)

    if new_start <= now:
        return "That time has already passed. Please choose a future time."

    if hour < BOOKING_START_HOUR or hour >= BOOKING_END_HOUR:
        return "We only take bookings between 9 AM and 5 PM."

    if new_date.weekday() >= 5:
        return "We're only available Monday through Friday."

    # Update Google Calendar
    if google_event_id:
        try:
            service = get_service()
            service.events().patch(
                calendarId=settings.google_calendar_id,
                eventId=google_event_id,
                body={
                    "start": {"dateTime": new_start.isoformat(), "timeZone": TIMEZONE_STR},
                    "end": {"dateTime": new_end.isoformat(), "timeZone": TIMEZONE_STR},
                },
            ).execute()
            logger.info("[OK] calendar_service: event rescheduled id=%s", google_event_id)
        except Exception as e:
            logger.error("[ERROR] calendar_service: reschedule failed: %s", str(e))
            return "I ran into a problem rescheduling. Please try again."

    # Update Supabase
    if supabase and appt_id:
        try:
            supabase.table("appointments").update({
                "start_time": new_start.isoformat(),
                "end_time": new_end.isoformat(),
                "status": "rescheduled",
            }).eq("id", appt_id).execute()
        except Exception as e:
            logger.warning("[WARN] calendar_service: Supabase update failed: %s", str(e))

    date_display = _format_date(new_date)
    time_display = _format_time(new_start)
    return f"Done! Your appointment has been moved to {date_display} at {time_display}."


# ---------------------------------------------------------------------------
# cancel_appointment
# ---------------------------------------------------------------------------

def cancel_appointment(
    caller_phone: str,
    date_str: str = "",
    time_str: str = "",
) -> str:
    """Cancel a caller's upcoming appointment."""
    upcoming = _find_upcoming_appointments(caller_phone)
    if not upcoming:
        return "I don't see any upcoming appointments for this number."

    appointment = upcoming[0]
    if date_str:
        matched = _find_matching_appointment(upcoming, date_str, time_str)
        if matched:
            appointment = matched

    google_event_id = appointment.get("google_event_id", "")
    appt_id = appointment.get("id")

    # Delete from Google Calendar
    if google_event_id:
        try:
            service = get_service()
            service.events().delete(
                calendarId=settings.google_calendar_id,
                eventId=google_event_id,
            ).execute()
            logger.info("[OK] calendar_service: event deleted id=%s", google_event_id)
        except Exception as e:
            logger.error("[ERROR] calendar_service: cancel failed: %s", str(e))
            return "I ran into a problem cancelling. Please try again."

    # Soft-delete in Supabase
    if supabase and appt_id:
        try:
            supabase.table("appointments").update({"status": "cancelled"}).eq("id", appt_id).execute()
        except Exception as e:
            logger.warning("[WARN] calendar_service: Supabase cancel update failed: %s", str(e))

    start_str = appointment.get("start_time", "")
    if start_str:
        try:
            start_dt = datetime.fromisoformat(start_str).astimezone(TIMEZONE)
            display = f"{_format_date(start_dt.date())} at {_format_time(start_dt)}"
        except Exception:
            display = "your appointment"
    else:
        display = "your appointment"

    return f"Done. I've cancelled {display}. Let us know if you'd like to rebook."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_upcoming_appointments(caller_phone: str) -> list[dict]:
    """Query Supabase for upcoming booked/rescheduled appointments by phone."""
    if not supabase or not caller_phone:
        return []
    try:
        now_iso = datetime.now(TIMEZONE).isoformat()
        result = (
            supabase.table("appointments")
            .select("*")
            .eq("caller_phone", caller_phone)
            .in_("status", ["booked", "rescheduled"])
            .gte("start_time", now_iso)
            .order("start_time")
            .limit(10)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning("[WARN] calendar_service: appointment lookup failed: %s", str(e))
        return []


def _find_matching_appointment(appointments: list[dict], date_str: str, time_str: str) -> dict | None:
    """Find the appointment closest to the given date/time."""
    parsed_date = _parse_date(date_str)
    parsed_time = _parse_time(time_str) if time_str else None

    for appt in appointments:
        start_str = appt.get("start_time", "")
        if not start_str:
            continue
        try:
            start_dt = datetime.fromisoformat(start_str).astimezone(TIMEZONE)
        except Exception:
            continue

        if parsed_date and start_dt.date() == parsed_date:
            if parsed_time is None:
                return appt
            if start_dt.hour == parsed_time[0] and start_dt.minute == parsed_time[1]:
                return appt

    return None
