# config.py — loads all environment variables from .env
# pydantic-settings validates types and raises clear errors on startup if anything is missing

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str

    # Google Calendar
    google_calendar_id: str = "primary"
    google_credentials_file: str = "credentials.json"
    google_token_file: str = "token.json"

    # Twilio (SMS to callers)
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None

    # Telegram (staff group chat notifications)
    telegram_bot_token: Optional[str] = None
    telegram_channel_id: Optional[str] = None

    # Vapi
    vapi_api_key: Optional[str] = None

    # App
    environment: str = "development"
    port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Single shared instance — import this everywhere
settings = Settings()
