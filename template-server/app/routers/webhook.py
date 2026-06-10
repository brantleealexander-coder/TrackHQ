# webhook.py — POST /webhook/vapi
# Receives all Vapi events: tool-calls, end-of-call-report, status-update
# All responses are HTTP 200 — Vapi will retry on any other status code

import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.services.call_service import save_call_report

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Load business config at startup ---
_CONFIG_PATH = Path(__file__).parent.parent / "business_config.json"
_business_config: dict = {}

if _CONFIG_PATH.exists():
    try:
        with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
            _business_config = json.load(f)
        logger.info("[OK] webhook: business_config.json loaded")
    except Exception as e:
        logger.warning("[WARN] webhook: could not load business_config.json: %s", str(e))
else:
    logger.info("[OK] webhook: business_config.json not found — copy business_config.example.json and fill it in for this tenant")


def _feature_enabled(name: str, default: bool = False) -> bool:
    return bool(_business_config.get("features", {}).get(name, default))


_CALENDAR_DISABLED_MESSAGE = (
    "I'm sorry, this business doesn't take appointment bookings by phone. "
    "Let me take a message and have the team follow up."
)


# ---------------------------------------------------------------------------
# Main webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhook/vapi")
async def vapi_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        logger.warning("[WARN] webhook: could not parse JSON body")
        return JSONResponse({"status": "ok"}, status_code=200)

    logger.debug("[DEBUG] webhook: raw body: %s", json.dumps(body))

    # Vapi wraps events in a "message" key; fall back to the body itself
    message = body.get("message", body)
    msg_type = message.get("type", "unknown")

    logger.info("[OK] webhook: received message type=%s", msg_type)

    if msg_type in ("tool-calls", "tool-call"):
        return await handle_tool_calls(message)

    if msg_type == "function-call":
        return await handle_function_call(message)

    if msg_type == "end-of-call-report":
        await handle_end_of_call_report(message)
        return JSONResponse({"status": "ok"}, status_code=200)

    if msg_type == "status-update":
        handle_status_update(message)
        return JSONResponse({"status": "ok"}, status_code=200)

    logger.debug("[DEBUG] webhook: unhandled message type=%s", msg_type)
    return JSONResponse({"status": "ok"}, status_code=200)


# ---------------------------------------------------------------------------
# Helper: extract caller phone from multiple possible paths
# ---------------------------------------------------------------------------

def get_caller_phone(message: dict) -> str:
    call = message.get("call", {})
    customer = call.get("customer", {}) or message.get("customer", {})
    return (
        customer.get("number")
        or customer.get("phoneNumber")
        or ""
    )


# ---------------------------------------------------------------------------
# Tool-calls dispatcher
# ---------------------------------------------------------------------------

async def handle_tool_calls(message: dict) -> JSONResponse:
    tool_call_list = message.get("toolCallList", [])
    results = []

    for tc in tool_call_list:
        # Support two formats:
        # 1. Flat:   {"id": "...", "name": "...", "parameters": {...}}
        # 2. Nested: {"id": "...", "function": {"name": "...", "arguments": "..."}}
        tc_id = tc.get("id", "")

        if "function" in tc:
            fn = tc["function"]
            name = fn.get("name", "")
            raw_args = fn.get("arguments", "{}")
            if isinstance(raw_args, str):
                try:
                    params = json.loads(raw_args)
                except Exception:
                    params = {}
            else:
                params = raw_args or {}
        else:
            name = tc.get("name", "")
            params = tc.get("parameters", tc.get("arguments", {}))
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}

        logger.info("[OK] webhook: tool call name=%s id=%s", name, tc_id)

        result = await dispatch_tool(name, params, message)

        # Vapi cannot parse multi-line strings — flatten newlines
        result_str = str(result).replace("\n", ". ").replace("\r", "")

        results.append({"toolCallId": tc_id, "result": result_str})

    return JSONResponse({"results": results}, status_code=200)


async def handle_function_call(message: dict) -> JSONResponse:
    """Legacy single function-call format."""
    fn = message.get("functionCall", {})
    name = fn.get("name", "")
    params = fn.get("parameters", {})
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except Exception:
            params = {}

    logger.info("[OK] webhook: function call name=%s", name)
    result = await dispatch_tool(name, params, message)
    result_str = str(result).replace("\n", ". ").replace("\r", "")
    return JSONResponse({"result": result_str}, status_code=200)


# ---------------------------------------------------------------------------
# Dispatch table — routes tool name to handler
# ---------------------------------------------------------------------------

async def dispatch_tool(name: str, params: dict, message: dict) -> str:
    dispatch = {
        "lookupCaller":          tool_lookup_caller,
        "checkAvailability":     tool_check_availability,
        "bookAppointment":       tool_book_appointment,
        "rescheduleAppointment": tool_reschedule_appointment,
        "cancelAppointment":     tool_cancel_appointment,
        "getBusinessInfo":       tool_get_business_info,
        "takeMessage":           tool_take_message,
        "dispatchMechanic":      tool_dispatch_mechanic,
        # Rental ordering (Phase 5f)
        "checkAssetAvailability": tool_check_asset_availability,
        "quoteRentalRate":        tool_quote_rental_rate,
        "bookRental":             tool_book_rental,
    }

    handler = dispatch.get(name)
    if handler is None:
        logger.warning("[WARN] webhook: unknown tool name=%s", name)
        return f"Unknown tool: {name}"

    try:
        return await handler(params, message)
    except Exception as e:
        logger.error("[ERROR] webhook: tool %s raised: %s", name, str(e))
        return "I'm sorry, I ran into a technical issue. Please try again."


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

async def tool_lookup_caller(params: dict, message: dict) -> str:
    from app.database import supabase
    from datetime import datetime, timezone

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    if not caller_phone:
        return "I don't have a phone number for this caller, so I can't look up their history."

    if not supabase:
        return "I don't have any previous records for this caller."

    try:
        result = (
            supabase.table("appointments")
            .select("caller_name, start_time, end_time, status")
            .eq("caller_phone", caller_phone)
            .order("start_time", desc=True)
            .limit(10)
            .execute()
        )
    except Exception as e:
        logger.error("[ERROR] webhook: lookupCaller failed: %s", str(e))
        return "I wasn't able to look up the caller's history right now."

    rows = result.data or []
    if not rows:
        return "I don't have any previous records for this caller. Welcome as a new client!"

    # Get name from most recent appointment
    caller_name = ""
    for row in rows:
        if row.get("caller_name"):
            caller_name = row["caller_name"]
            break

    now_utc = datetime.now(timezone.utc).isoformat()
    upcoming = [r for r in rows if r.get("start_time", "") >= now_utc and r.get("status") != "cancelled"]
    past     = [r for r in rows if r.get("start_time", "") <  now_utc or  r.get("status") == "cancelled"]

    parts = []
    if caller_name:
        parts.append(f"Caller name: {caller_name}.")

    if upcoming:
        apt = upcoming[0]
        start = apt.get("start_time", "")
        try:
            dt = datetime.fromisoformat(start)
            from app.services.calendar_service import _format_date, _format_time, TIMEZONE
            dt_local = dt.astimezone(TIMEZONE)
            slot = f"{_format_date(dt_local.date())} at {_format_time(dt_local)}"
        except Exception:
            slot = start
        parts.append(f"Upcoming appointment: {slot}.")
    else:
        parts.append("No upcoming appointments.")

    parts.append(f"Total past appointments: {len(past)}.")

    return " ".join(parts)


async def tool_check_availability(params: dict, message: dict) -> str:
    if not _feature_enabled("google_calendar"):
        return _CALENDAR_DISABLED_MESSAGE
    from app.services.calendar_service import check_availability
    date_str = params.get("date", "")
    if not date_str:
        return "What date would you like to check availability for?"
    return check_availability(date_str)


async def tool_book_appointment(params: dict, message: dict) -> str:
    if not _feature_enabled("google_calendar"):
        return _CALENDAR_DISABLED_MESSAGE
    from app.services.calendar_service import book_appointment
    from app.services.sms_service import send_booking_confirmation

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    caller_name = params.get("callerName", "")
    date_str = params.get("date", "")
    time_str = params.get("time", "")

    if not date_str or not time_str:
        return "I need both a date and a time to book the appointment."

    result = book_appointment(caller_phone, caller_name, date_str, time_str, params.get("notes", ""))

    # Send SMS confirmation (non-blocking)
    if "booked" in result.lower() or "confirmed" in result.lower():
        from app.services.calendar_service import _parse_date, _parse_time, _format_date, _format_time, TIMEZONE
        from datetime import datetime
        try:
            pd = _parse_date(date_str)
            pt = _parse_time(time_str)
            if pd and pt:
                start_dt = datetime(pd.year, pd.month, pd.day, pt[0], pt[1], tzinfo=TIMEZONE)
                send_booking_confirmation(caller_phone, caller_name, _format_date(pd), _format_time(start_dt))
        except Exception:
            pass

    return result


async def tool_reschedule_appointment(params: dict, message: dict) -> str:
    if not _feature_enabled("google_calendar"):
        return _CALENDAR_DISABLED_MESSAGE
    from app.services.calendar_service import reschedule_appointment
    from app.services.sms_service import send_reschedule_confirmation

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    new_date_str = params.get("newDate", "")
    new_time_str = params.get("newTime", "")

    if not new_date_str or not new_time_str:
        return "I need a new date and time to reschedule."

    result = reschedule_appointment(
        caller_phone,
        new_date_str,
        new_time_str,
        params.get("currentDate", ""),
        params.get("currentTime", ""),
    )

    if "moved" in result.lower() or "rescheduled" in result.lower():
        from app.services.calendar_service import _parse_date, _parse_time, _format_date, _format_time, TIMEZONE
        from datetime import datetime
        try:
            pd = _parse_date(new_date_str)
            pt = _parse_time(new_time_str)
            caller_name = params.get("callerName", "")
            if pd and pt:
                start_dt = datetime(pd.year, pd.month, pd.day, pt[0], pt[1], tzinfo=TIMEZONE)
                send_reschedule_confirmation(caller_phone, caller_name, _format_date(pd), _format_time(start_dt))
        except Exception:
            pass

    return result


async def tool_cancel_appointment(params: dict, message: dict) -> str:
    if not _feature_enabled("google_calendar"):
        return _CALENDAR_DISABLED_MESSAGE
    from app.services.calendar_service import cancel_appointment
    from app.services.sms_service import send_cancellation_confirmation

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    caller_name = params.get("callerName", "")

    result = cancel_appointment(
        caller_phone,
        params.get("date", ""),
        params.get("time", ""),
    )

    if "cancelled" in result.lower():
        send_cancellation_confirmation(caller_phone, caller_name)

    return result


async def tool_get_business_info(params: dict, message: dict) -> str:
    if not _business_config:
        return "Business information is not yet configured."

    topic = params.get("topic", "").lower().strip()
    faqs = _business_config.get("faqs", {})
    keyword_map = _business_config.get("keyword_map", {})

    # 1. Direct FAQ key match
    if topic in faqs:
        return faqs[topic]

    # 2. Keyword map — find which FAQ key best matches the topic
    for faq_key, keywords in keyword_map.items():
        for kw in keywords:
            if kw in topic:
                if faq_key in faqs:
                    return faqs[faq_key]

    # 3. Partial match — topic substring appears in a FAQ key
    for faq_key, answer in faqs.items():
        if topic and (topic in faq_key or faq_key in topic):
            return answer

    # 4. Fallback to about text
    return _business_config.get("about", "I don't have that information right now.")


async def tool_take_message(params: dict, message: dict) -> str:
    from app.database import supabase
    from app.services.telegram_service import send_voicemail

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    caller_name = params.get("callerName", "")
    msg_text = params.get("message", params.get("messageText", ""))
    raw_urgency = params.get("urgency", "normal").lower().strip()
    urgency = raw_urgency if raw_urgency in ("normal", "urgent", "low") else "normal"

    # Save to messages table
    if supabase and msg_text:
        try:
            row: dict = {"urgency": urgency}
            if caller_phone:
                row["caller_phone"] = caller_phone
            if caller_name:
                row["caller_name"] = caller_name
            if msg_text:
                row["message_text"] = msg_text
            supabase.table("messages").insert(row).execute()
            logger.info("[OK] webhook: message saved phone=%s urgency=%s", caller_phone, urgency)
        except Exception as e:
            logger.error("[ERROR] webhook: failed to save message: %s", str(e))

    # Telegram notification
    try:
        send_voicemail(caller_name, caller_phone, msg_text)
    except Exception as e:
        logger.error("[ERROR] webhook: telegram notify failed: %s", str(e))

    if urgency == "urgent":
        return "I've passed your urgent message to the team right away. Someone will follow up with you as soon as possible."
    return "Message noted. I'll make sure the team gets it."


async def tool_dispatch_mechanic(params: dict, message: dict) -> str:
    from app.database import supabase
    from app.services.telegram_service import send_mechanic_needed

    caller_phone = params.get("callerPhone") or get_caller_phone(message)
    if caller_phone and not caller_phone.startswith("+"):
        caller_phone = "+1" + caller_phone
    caller_name  = params.get("callerName", "")
    equipment    = params.get("equipmentType", "Unknown equipment")
    issue        = params.get("issueDescription", "No description provided")
    location     = params.get("jobSiteLocation", "Location not given")
    raw_urgency  = params.get("urgency", "urgent").lower().strip()
    urgency      = raw_urgency if raw_urgency in ("normal", "urgent") else "urgent"

    dispatch_msg = (
        f"Equipment: {equipment}. "
        f"Issue: {issue}. "
        f"Location: {location}."
    )

    if supabase:
        try:
            row: dict = {"urgency": urgency}
            if caller_phone:
                row["caller_phone"] = caller_phone
            if caller_name:
                row["caller_name"] = caller_name
            row["message_text"] = dispatch_msg
            supabase.table("messages").insert(row).execute()
            logger.info("[OK] webhook: mechanic dispatch saved phone=%s equipment=%s", caller_phone, equipment)
        except Exception as e:
            logger.error("[ERROR] webhook: failed to save mechanic dispatch: %s", str(e))

    try:
        send_mechanic_needed(caller_name, caller_phone, dispatch_msg)
    except Exception as e:
        logger.error("[ERROR] webhook: telegram mechanic notify failed: %s", str(e))

    if caller_phone:
        try:
            from app.services.sms_service import send_mechanic_dispatch_confirmation
            send_mechanic_dispatch_confirmation(caller_phone, caller_name, equipment)
        except Exception as e:
            logger.error("[ERROR] webhook: mechanic SMS confirmation failed: %s", str(e))

    return (
        "I've sent an alert to our mechanic team with your equipment and location details. "
        "Someone will contact you as soon as possible."
    )


# ---------------------------------------------------------------------------
# End-of-call report handler
# ---------------------------------------------------------------------------

async def handle_end_of_call_report(message: dict):
    """
    Fires after every call. Key fields (startedAt, endedAt, durationSeconds,
    summary) are at the TOP LEVEL of message, not inside 'call'.
    """
    call = message.get("call", {})
    vapi_call_id = call.get("id", "")

    # Top-level timing fields
    started_at = message.get("startedAt")
    ended_at = message.get("endedAt")
    duration_raw = message.get("durationSeconds")
    duration_seconds = int(round(duration_raw)) if duration_raw is not None else None

    summary = message.get("summary", "")
    artifact = message.get("artifact", {})
    analysis = message.get("analysis", {})

    # Caller phone
    caller_phone = get_caller_phone(message)

    # Caller name — 4-tier cascade
    caller_name = _extract_caller_name(call, summary, artifact, caller_phone)

    # Transcript — prefer structured messages, fall back to plain text
    transcript = artifact.get("messages") or artifact.get("transcript") or None

    # Recording URL — VAPI puts it in artifact.recordingUrl; fall back to
    # message.recordingUrl for older payload shapes.
    recording_url = artifact.get("recordingUrl") or message.get("recordingUrl") or None

    # Outcome from analysis
    outcome = "inquiry"
    if analysis:
        outcome = analysis.get("structuredData", {}).get("outcome", "inquiry") or "inquiry"

    logger.info(
        "[OK] webhook: end-of-call phone=%s name=%s duration=%s outcome=%s recording=%s",
        caller_phone, caller_name, duration_seconds, outcome, bool(recording_url)
    )

    save_call_report(
        vapi_call_id=vapi_call_id,
        caller_phone=caller_phone,
        caller_name=caller_name,
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=duration_seconds,
        summary=summary,
        transcript=transcript,
        outcome=outcome,
        company_id=settings.demo_company_id,
        recording_url=recording_url,
    )


def _extract_caller_name(call: dict, summary: str, artifact: dict, phone: str) -> str:
    """4-tier cascade for caller name extraction."""

    # 1. call.customer.name (real phone calls)
    customer = call.get("customer", {})
    if customer.get("name"):
        return customer["name"]

    # 2. Regex on AI summary
    if summary:
        patterns = [
            r"^([A-Z][a-z]+ [A-Z][a-z]+) called",
            r"Caller(?:'s)? name[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)",
            r"([A-Z][a-z]+ [A-Z][a-z]+) (?:is calling|called in|scheduled)",
        ]
        for pattern in patterns:
            m = re.search(pattern, summary)
            if m:
                return m.group(1)

    # 3. Scan artifact.messages for toolCalls with a name parameter
    messages = artifact.get("messages", [])
    for msg in messages:
        for tc in msg.get("toolCalls", []):
            fn = tc.get("function", {})
            raw_args = fn.get("arguments", "{}")
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            else:
                args = raw_args or {}
            name = args.get("callerName") or args.get("name") or args.get("caller_name")
            if name:
                return name

    # 4. Query Supabase for most recent appointment by phone
    if phone:
        try:
            from app.database import supabase
            if supabase:
                result = (
                    supabase.table("appointments")
                    .select("caller_name")
                    .eq("caller_phone", phone)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data and result.data[0].get("caller_name"):
                    return result.data[0]["caller_name"]
        except Exception as e:
            logger.warning("[WARN] webhook: name lookup failed: %s", str(e))

    return ""


# ---------------------------------------------------------------------------
# Rental ordering tools (Phase 5f) — voice agent equivalents of the /book
# hosted POS flow. They read/write the same per-tenant tables (equipment,
# equipment_status, statuses, booking_requests) but speak voice-friendly
# sentences instead of returning JSON.
# ---------------------------------------------------------------------------

def _fmt_money(n) -> str:
    if n is None:
        return "no listed rate"
    try:
        return f"${int(round(float(n))):,}"
    except Exception:
        return str(n)


def _upsert_voice_customer(supabase, name: str, email: str, phone: str):
    """Phase 6f — find-or-create a customers row from voice-booking contact.

    Dedupes by email (case-insensitive) first, then phone within the demo
    tenant. Returns the customer id, or None if the customers table is
    missing (pre-6 fork) or the insert fails. Best-effort: failures don't
    block the booking.
    """
    try:
        if email:
            existing = (
                supabase.table("customers")
                .select("id")
                .eq("company_id", settings.demo_company_id)
                .ilike("email", email)
                .limit(1)
                .execute()
            )
            if existing.data:
                return existing.data[0]["id"]
        if phone:
            existing = (
                supabase.table("customers")
                .select("id")
                .eq("company_id", settings.demo_company_id)
                .eq("phone", phone)
                .limit(1)
                .execute()
            )
            if existing.data:
                return existing.data[0]["id"]

        row = {"name": name, "company_id": settings.demo_company_id}
        if email:
            row["email"] = email
        if phone:
            row["phone"] = phone
        result = supabase.table("customers").insert(row).execute()
        return (result.data or [{}])[0].get("id")
    except Exception as e:
        logger.warning("[WARN] webhook: customer upsert skipped: %s", str(e))
        return None


def _available_status_keys(supabase) -> set:
    # statuses table is global (shared across companies) so no company_id
    # scoping needed here; safe as-is.
    try:
        result = (
            supabase.table("statuses")
            .select("key, behavior")
            .eq("behavior", "available")
            .execute()
        )
        return {r["key"] for r in (result.data or [])}
    except Exception as e:
        logger.warning("[WARN] webhook: status keys lookup failed: %s", str(e))
        return set()


async def tool_check_asset_availability(params: dict, message: dict) -> str:
    from app.database import supabase
    if not supabase:
        return "I can't check inventory right now."

    # Be forgiving with how the model phrases the search term. Callers say
    # "excavators" (plural) when the equipment_name is "CAT 314 Excavator"
    # (singular), and the model sometimes puts the type ("excavator") in
    # `category` even though the categories table uses broader names like
    # "Heavy Equipment". We strip a trailing 's' for cheap pluralization
    # and check the term against equipment_name + category_name + gl_code.
    def _normalize(q: str) -> str:
        q = q.strip().lower()
        if len(q) > 3 and q.endswith("s"):
            q = q[:-1]
        return q

    category = _normalize(params.get("category") or "")
    asset_query = _normalize(params.get("assetQuery") or "")

    available_keys = _available_status_keys(supabase)
    if not available_keys:
        return "I'm not finding any available units in our system right now."

    try:
        rows = (
            supabase.table("equipment")
            .select(
                "id, gl_code, equipment_name, year, rate_daily, rate_weekly, "
                "rate_monthly, categories(name), equipment_status(status)"
            )
            .eq("company_id", settings.demo_company_id)
            .order("equipment_name")
            .execute()
        ).data or []
    except Exception as e:
        logger.error("[ERROR] webhook: checkAssetAvailability: %s", str(e))
        return "I ran into an issue looking up our inventory."

    matches = []
    for r in rows:
        status_rows = r.get("equipment_status") or []
        status_key = status_rows[0].get("status") if status_rows else None
        if status_key not in available_keys:
            continue
        cat_name = ((r.get("categories") or {}).get("name") or "").lower()
        name = (r.get("equipment_name") or "").lower()
        gl = (r.get("gl_code") or "").lower()
        # `category` may match either a real category row OR an equipment
        # type word in the name ("excavator"); accept either.
        if category and category not in cat_name and category not in name:
            continue
        if asset_query and asset_query not in name and asset_query not in gl:
            continue
        matches.append(r)

    if not matches:
        if category or asset_query:
            return "I'm not seeing anything matching that available right now. Want me to take a message so the team can call you back with options?"
        return "I'm not seeing anything available right now."

    head = matches[:3]
    pieces = []
    for r in head:
        rate = _fmt_money(r.get("rate_daily"))
        pieces.append(
            f"{r.get('equipment_name')} (GL code {r.get('gl_code')}) at {rate} per day"
        )
    if len(matches) > 3:
        return ". ".join(pieces) + f". I have {len(matches) - 3} more available — want me to keep reading?"
    return ". ".join(pieces) + "."


async def tool_quote_rental_rate(params: dict, message: dict) -> str:
    from app.database import supabase
    if not supabase:
        return "I can't pull rates right now."

    gl_code = (params.get("glCode") or "").strip()
    asset_name = (params.get("assetName") or "").strip()
    rate_type = (params.get("rateType") or "").strip().lower()
    duration_days = params.get("durationDays")

    # Strip trailing plural 's' so "excavators" still matches "Excavator".
    if len(asset_name) > 3 and asset_name.lower().endswith("s"):
        asset_name = asset_name[:-1]

    if rate_type not in ("daily", "weekly", "monthly"):
        return "I need to know if you want daily, weekly, or monthly pricing."

    if not gl_code and not asset_name:
        return "Which unit are you asking about? You can give me the GL code or just the name."

    try:
        q = supabase.table("equipment").select(
            "id, gl_code, equipment_name, rate_daily, rate_weekly, rate_monthly"
        ).eq("company_id", settings.demo_company_id)
        if gl_code:
            q = q.ilike("gl_code", gl_code)
        else:
            q = q.ilike("equipment_name", f"%{asset_name}%")
        rows = q.limit(1).execute().data or []
    except Exception as e:
        logger.error("[ERROR] webhook: quoteRentalRate: %s", str(e))
        return "I ran into an issue pulling that rate."

    if not rows:
        return "I'm not finding that unit in our system. Can you double-check the name or GL code?"

    unit = rows[0]
    rate_col = {"daily": "rate_daily", "weekly": "rate_weekly", "monthly": "rate_monthly"}[rate_type]
    base = unit.get(rate_col)
    if base is None:
        return f"The {unit.get('equipment_name')} doesn't have a published {rate_type} rate — I'd need to grab someone for a quote."

    base_str = _fmt_money(base)
    line = f"The {rate_type} rate on the {unit.get('equipment_name')} is {base_str}"

    if duration_days:
        try:
            days = int(duration_days)
        except Exception:
            days = 0
        if days > 0:
            if rate_type == "daily":
                total = float(base) * days
            elif rate_type == "weekly":
                periods = max(1, -(-days // 7))  # ceil
                total = float(base) * periods
            else:
                periods = max(1, -(-days // 28))
                total = float(base) * periods
            return f"{line}. For {days} day{'s' if days != 1 else ''} that comes to about {_fmt_money(total)}."

    return f"{line}."


async def tool_book_rental(params: dict, message: dict) -> str:
    from app.database import supabase
    if not supabase:
        return "I can't take bookings right now. Let me take a message instead."

    caller_phone = (params.get("callerPhone") or get_caller_phone(message) or "").strip()
    caller_name = (params.get("callerName") or "").strip()
    caller_email = (params.get("callerEmail") or "").strip()
    gl_code = (params.get("glCode") or "").strip()
    asset_name = (params.get("assetName") or "").strip()
    rental_start = (params.get("rentalStart") or "").strip()
    rental_end = (params.get("rentalEnd") or "").strip()
    rate_type = (params.get("rateType") or "").strip().lower() or None
    notes = (params.get("notes") or "").strip() or None

    if not caller_name:
        return "I need your name to book this. Who am I speaking with?"
    if not rental_start or not rental_end:
        return "I need start and end dates for the rental."
    if not (gl_code or asset_name):
        return "Which unit are we booking? GL code or name works."
    if rate_type and rate_type not in ("daily", "weekly", "monthly"):
        rate_type = None

    try:
        q = supabase.table("equipment").select("id, gl_code, equipment_name").eq(
            "company_id", settings.demo_company_id
        )
        if gl_code:
            q = q.ilike("gl_code", gl_code)
        else:
            q = q.ilike("equipment_name", f"%{asset_name}%")
        rows = q.limit(1).execute().data or []
    except Exception as e:
        logger.error("[ERROR] webhook: bookRental lookup: %s", str(e))
        return "I ran into an issue finding that unit."

    if not rows:
        return "I'm not finding that unit. Want me to take a message so we can confirm and call you back?"

    unit = rows[0]

    # Phase 6f — dedupe/create a customers row before writing the booking
    # request so the CRM stays the source of truth. Best-effort; if the
    # customers table is missing (pre-6 fork), fall through with no link.
    customer_id = _upsert_voice_customer(
        supabase,
        name=caller_name,
        email=caller_email,
        phone=caller_phone,
    )

    payload = {
        "company_id": settings.demo_company_id,
        "equipment_id": unit["id"],
        "renter_name": caller_name,
        "renter_email": caller_email or "voice@trackhq.tech",
        "renter_phone": caller_phone or None,
        "rental_start": rental_start,
        "rental_end": rental_end,
        "rate_type": rate_type,
        "notes": notes,
        "source": "voice",
    }
    if customer_id is not None:
        payload["customer_id"] = customer_id

    try:
        result = supabase.table("booking_requests").insert(payload).execute()
        row = (result.data or [{}])[0]
        booking_id = row.get("id")
    except Exception as e:
        logger.error("[ERROR] webhook: bookRental insert: %s", str(e))
        return "I couldn't save the booking. Let me take a message and the team will call you right back."

    ref = f"#{int(booking_id):06d}" if booking_id else ""
    return (
        f"Booked. I have you down for the {unit.get('equipment_name')} from {rental_start} to {rental_end}. "
        f"The team will confirm by phone or email shortly. Reference {ref}."
    )


# ---------------------------------------------------------------------------
# Status-update handler
# ---------------------------------------------------------------------------

def handle_status_update(message: dict):
    status = message.get("status", "unknown")
    call_id = message.get("call", {}).get("id", "")
    logger.info("[OK] webhook: status-update status=%s call_id=%s", status, call_id)
