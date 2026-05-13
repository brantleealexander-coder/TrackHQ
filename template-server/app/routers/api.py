# api.py — Dashboard JSON endpoints (Phase 6)
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Query

from app.database import supabase
from app.schemas import StatsResponse, PaginatedResponse


router = APIRouter()


def _require_supabase():
    if supabase is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database not configured")


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    _require_supabase()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    calls_today = supabase.table("call_logs").select("id", count="exact").gte("created_at", today_start).execute().count or 0
    calls_this_week = supabase.table("call_logs").select("id", count="exact").gte("created_at", week_start).execute().count or 0
    active_appointments = (
        supabase.table("appointments").select("id", count="exact")
        .eq("status", "booked").gte("start_time", now.isoformat()).execute().count or 0
    )
    total_messages = supabase.table("messages").select("id", count="exact").execute().count or 0

    return StatsResponse(
        calls_today=calls_today,
        calls_this_week=calls_this_week,
        active_appointments=active_appointments,
        total_messages=total_messages,
    )


@router.get("/calls", response_model=PaginatedResponse)
async def get_calls(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    _require_supabase()
    offset = (page - 1) * page_size
    total = supabase.table("call_logs").select("id", count="exact").execute().count or 0
    rows = (
        supabase.table("call_logs")
        .select("id, vapi_call_id, caller_phone, caller_name, started_at, ended_at, duration_seconds, summary, outcome, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
        .data or []
    )
    return PaginatedResponse(items=rows, total=total, page=page, page_size=page_size)


@router.get("/messages", response_model=PaginatedResponse)
async def get_messages(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    urgency: Optional[str] = Query(None),
):
    _require_supabase()
    offset = (page - 1) * page_size
    q = supabase.table("messages").select("id, caller_phone, caller_name, message_text, urgency, created_at", count="exact")
    if urgency:
        q = q.eq("urgency", urgency)
    result = q.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return PaginatedResponse(items=result.data or [], total=result.count or 0, page=page, page_size=page_size)


@router.get("/reservations", response_model=PaginatedResponse)
async def get_reservations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    upcoming_only: bool = Query(True),
):
    _require_supabase()
    offset = (page - 1) * page_size
    now = datetime.now(timezone.utc).isoformat()
    q = supabase.table("appointments").select(
        "id, caller_phone, caller_name, start_time, google_event_id",
        count="exact"
    )
    if upcoming_only:
        q = q.gte("start_time", now).neq("status", "cancelled")
    result = q.order("start_time", desc=not upcoming_only).range(offset, offset + page_size - 1).execute()
    items = [
        {**row, "pickup_time": row.pop("start_time")}
        for row in (result.data or [])
    ]
    return PaginatedResponse(items=items, total=result.count or 0, page=page, page_size=page_size)
