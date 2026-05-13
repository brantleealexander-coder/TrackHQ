# database.py — shared Supabase client (built fully in Phase 2)
# Imported by main.py on startup for the connection check
import logging
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

# Create Supabase client, or set to None if credentials are missing
if settings.supabase_url and settings.supabase_key:
    supabase = create_client(settings.supabase_url, settings.supabase_key)
else:
    supabase = None
    logger.warning("[WARN] SUPABASE_URL or SUPABASE_KEY not set — database features disabled")
