# call_service.py — Save end-of-call reports to Supabase

import logging
from app.database import supabase

logger = logging.getLogger(__name__)


def save_call_report(
    vapi_call_id: str = None,
    caller_phone: str = None,
    caller_name: str = None,
    started_at: str = None,
    ended_at: str = None,
    duration_seconds: int = None,
    summary: str = None,
    transcript=None,
    outcome: str = "inquiry",
) -> dict:
    """Insert a call log row into Supabase. Returns the inserted row or {} on failure."""
    if supabase is None:
        logger.warning("[WARN] call_service: Supabase not configured, skipping save")
        return {}

    # Build row with only non-empty fields to avoid overwriting defaults
    row = {"outcome": outcome}
    if vapi_call_id:
        row["vapi_call_id"] = vapi_call_id
    if caller_phone:
        row["caller_phone"] = caller_phone
    if caller_name:
        row["caller_name"] = caller_name
    if started_at:
        row["started_at"] = started_at
    if ended_at:
        row["ended_at"] = ended_at
    if duration_seconds is not None:
        row["duration_seconds"] = duration_seconds
    if summary:
        row["summary"] = summary
    if transcript is not None:
        row["transcript"] = transcript

    try:
        result = supabase.table("call_logs").insert(row).execute()
        if result.data:
            logger.info("[OK] call_service: saved call log id=%s", result.data[0].get("id"))
            return result.data[0]
        return {}
    except Exception as e:
        logger.error("[ERROR] call_service: failed to save call log: %s", str(e))
        return {}
