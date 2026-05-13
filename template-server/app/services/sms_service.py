# sms_service.py — Twilio SMS confirmations to callers

import logging
from app.config import settings

logger = logging.getLogger(__name__)

_client = None

# Graceful init — if credentials missing, SMS is silently disabled
if settings.twilio_account_sid and settings.twilio_auth_token:
    try:
        from twilio.rest import Client
        _client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        logger.info("[OK] sms_service: Twilio client initialized")
    except Exception as e:
        logger.warning("[WARN] sms_service: Twilio init failed: %s", str(e))
else:
    logger.info("[OK] sms_service: Twilio not configured — SMS disabled")


def send_sms(to: str, body: str) -> bool:
    """Send an SMS. Returns True on success, False on failure. Never raises."""
    if _client is None:
        logger.debug("[DEBUG] sms_service: skipping SMS (not configured)")
        return False
    if not to:
        logger.debug("[DEBUG] sms_service: skipping SMS (no phone number)")
        return False
    try:
        _client.messages.create(
            to=to,
            from_=settings.twilio_phone_number,
            body=body,
        )
        logger.info("[OK] sms_service: SMS sent to %s", to)
        return True
    except Exception as e:
        logger.error("[ERROR] sms_service: failed to send SMS to %s: %s", to, str(e))
        return False


def send_booking_confirmation(phone: str, name: str, date_display: str, time_display: str) -> bool:
    greeting = f"Hi {name}!" if name else "Hi!"
    body = (
        f"{greeting} Your appointment has been confirmed for "
        f"{date_display} at {time_display}. "
        f"Reply CANCEL to cancel."
    )
    return send_sms(phone, body)


def send_reschedule_confirmation(phone: str, name: str, date_display: str, time_display: str) -> bool:
    greeting = f"Hi {name}!" if name else "Hi!"
    body = (
        f"{greeting} Your appointment has been rescheduled to "
        f"{date_display} at {time_display}. "
        f"Reply CANCEL to cancel."
    )
    return send_sms(phone, body)


def send_cancellation_confirmation(phone: str, name: str) -> bool:
    greeting = f"Hi {name}," if name else "Hi,"
    body = f"{greeting} your appointment has been cancelled. Call us to rebook anytime."
    return send_sms(phone, body)


def send_mechanic_dispatch_confirmation(phone: str, name: str, equipment: str) -> bool:
    greeting = f"Hi {name}!" if name else "Hi!"
    body = (
        f"{greeting} We've received your mechanic request for your {equipment}. "
        f"Our team has been alerted and will contact you shortly. - Crossmar Rentals"
    )
    return send_sms(phone, body)
