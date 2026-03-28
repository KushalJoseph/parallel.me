import os
from datetime import datetime, timezone
from database import rooms_collection

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

load_dotenv()

LAVA_SECRET_KEY = os.getenv("LAVA_SECRET_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def expire_rooms_job():
    """Marks rooms expired after their 24h expiresAt has passed"""
    now = datetime.now(timezone.utc)
    result = await rooms_collection.update_many(
        {"expiresAt": {"$lt": now}, "expired": False},
        {"$set": {"expired": True}}
    )
    if result.modified_count > 0:
        print(f"Expired {result.modified_count} rooms automatically.")

async def guardian_agent_job():
    """Agentic ambient checking on live rooms"""
    if not LAVA_SECRET_KEY:
        return
        
    # Logic note: Fetch recent messages from Supabase, then use Gemini
    # to evaluate distress or nudge chat if cold.
    # We are omitting complex Supabase queries for the MVP scaffolding.
    pass

scheduler = AsyncIOScheduler()

def start_jobs():
    scheduler.add_job(
        expire_rooms_job,
        trigger=IntervalTrigger(minutes=1),
        id="expire_rooms_job",
        replace_existing=True
    )
    
    scheduler.add_job(
        guardian_agent_job,
        trigger=IntervalTrigger(minutes=5),
        id="guardian_agent_job",
        replace_existing=True
    )
    
    scheduler.start()
