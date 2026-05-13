# telegram_service.py — Telegram Bot API for internal staff notifications

import logging
import urllib.request
import urllib.parse
import json

from app.config import settings

logger = logging.getLogger(__name__)

_configured = False

if settings.telegram_bot_token and settings.telegram_channel_id:
    _configured = True
    logger.info("[OK] telegram_service: Telegram configured")
else:
    logger.info("[OK] telegram_service: Telegram not configured — notifications disabled")


def send_message(text: str) -> bool:
    """Send a message to the configured Telegram channel. Never raises."""
    if not _configured:
        logger.debug("[DEBUG] telegram_service: skipping (not configured)")
        return False
    try:
        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        data = json.dumps({
            "chat_id": settings.telegram_channel_id,
            "text": text,
            "parse_mode": "HTML",
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.info("[OK] telegram_service: message sent")
                return True
            logger.warning("[WARN] telegram_service: unexpected status %s", resp.status)
            return False
    except Exception as e:
        logger.error("[ERROR] telegram_service: send failed: %s", str(e))
        return False


def send_mechanic_needed(caller_name: str, phone: str, message: str) -> bool:
    name_str = caller_name or "Unknown caller"
    phone_str = phone or "no number"
    text = (
        f"[MECHANIC NEEDED]\n"
        f"Caller: {name_str} ({phone_str})\n"
        f"Message: {message}"
    )
    return send_message(text)


def send_replacement_unit_needed(caller_name: str, phone: str, message: str) -> bool:
    name_str = caller_name or "Unknown caller"
    phone_str = phone or "no number"
    text = (
        f"[REPLACEMENT UNIT NEEDED]\n"
        f"Caller: {name_str} ({phone_str})\n"
        f"Message: {message}"
    )
    return send_message(text)


def send_voicemail(caller_name: str, phone: str, message: str) -> bool:
    name_str = caller_name or "Unknown caller"
    phone_str = phone or "no number"
    text = (
        f"[VOICEMAIL]\n"
        f"From: {name_str} ({phone_str})\n"
        f"Message: {message}"
    )
    return send_message(text)


def send_missed_transfer(caller_name: str, phone: str) -> bool:
    name_str = caller_name or "Unknown caller"
    phone_str = phone or "no number"
    text = (
        f"[MISSED TRANSFER]\n"
        f"Caller: {name_str} ({phone_str}) could not be connected. Please follow up."
    )
    return send_message(text)
