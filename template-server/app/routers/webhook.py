# webhook.py — POST /webhook/vapi
# Receives all Vapi events: tool-calls, end-of-call-report, status-update
# All responses are HTTP 200 — Vapi will retry on any other status code

import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

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
    logger.info("[OK] webhook: business_config.json not found yet (Phase 5)")


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
    from app.services.calendar_service import check_availability
    date_str = params.get("date", "")
    if not date_str:
        return "What date would you like to check availability for?"
    return check_availability(date_str)


async def tool_book_appointment(params: dict, message: dict) -> str:
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

    # Outcome from analysis
    outcome = "inquiry"
    if analysis:
        outcome = analysis.get("structuredData", {}).get("outcome", "inquiry") or "inquiry"

    logger.info(
        "[OK] webhook: end-of-call phone=%s name=%s duration=%s outcome=%s",
        caller_phone, caller_name, duration_seconds, outcome
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
# Status-update handler
# ---------------------------------------------------------------------------

def handle_status_update(message: dict):
    status = message.get("status", "unknown")
    call_id = message.get("call", {}).get("id", "")
    logger.info("[OK] webhook: status-update status=%s call_id=%s", status, call_id)
