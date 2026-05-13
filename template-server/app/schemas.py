# schemas.py — Pydantic models for request/response validation
# Used by routers and services to validate data in and out of Supabase

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


# --- Call Logs ---

class CallLogCreate(BaseModel):
    vapi_call_id: Optional[str] = None
    caller_phone: Optional[str] = None
    caller_name: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    summary: Optional[str] = None
    transcript: Optional[Any] = None  # JSONB
    outcome: str = "inquiry"


class CallLogRead(CallLogCreate):
    id: int
    created_at: datetime


# --- Appointments ---

class AppointmentCreate(BaseModel):
    google_event_id: Optional[str] = None
    caller_phone: Optional[str] = None
    caller_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: str = "booked"
    call_log_id: Optional[int] = None


class AppointmentRead(AppointmentCreate):
    id: int
    created_at: datetime


# --- Messages ---

class MessageCreate(BaseModel):
    caller_phone: Optional[str] = None
    caller_name: Optional[str] = None
    message_text: Optional[str] = None
    urgency: str = "normal"
    call_log_id: Optional[int] = None


class MessageRead(MessageCreate):
    id: int
    created_at: datetime


# --- Dashboard ---

class StatsResponse(BaseModel):
    calls_today: int
    calls_this_week: int
    active_appointments: int
    total_messages: int


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int


# --- VAPI Webhook ---

class VapiMessage(BaseModel):
    type: str
    call: Optional[dict] = None
    toolCallList: Optional[list[dict]] = None
    artifact: Optional[dict] = None
    analysis: Optional[dict] = None


class VapiWebhookRequest(BaseModel):
    message: VapiMessage
