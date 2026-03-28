import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import urllib.parse

from auth import get_current_user_id
from database import rooms_collection, entries_collection
from models import Room

router = APIRouter(prefix="/api/room", tags=["room"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LAVA_SECRET_KEY = os.getenv("LAVA_SECRET_KEY")

async def create_room_internal(user_a_id: str, entry_a_id, user_b_id: str, entry_b_id):
    # 1. Mark entries matched
    await entries_collection.update_many(
        {"_id": {"$in": [entry_a_id, entry_b_id]}},
        {"$set": {"matched": True}}
    )
    
    # 2. Get entries
    entry_a = await entries_collection.find_one({"_id": entry_a_id})
    entry_b = await entries_collection.find_one({"_id": entry_b_id})
    
    # 3. Generate Icebreaker via Lava wrapper of Groq
    icebreaker = "What is one thing you wish someone understood about your day today?"
    if LAVA_SECRET_KEY and entry_a and entry_b:
        prompt = f"""
        Read these two anonymous diary entries and generate ONE short, empathetic opening question that connects them.
        Entry 1: {entry_a['text']}
        Entry 2: {entry_b['text']}
        Just return the question alone. No quotes.
        """
        
        chat_endpoint = "https://api.lava.so/v1/chat/completions"
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    chat_endpoint,
                    headers={"Authorization": f"Bearer {LAVA_SECRET_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if text:
                        icebreaker = text.strip().strip('"')
                else:
                    print(f"Lava Error: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"Lava request failed: {e}")
            
    # 4. Create Room
    supabase_channel = f"room-{uuid.uuid4()}"
    new_room = Room(
        userAId=user_a_id,
        userBId=user_b_id,
        entryAId=str(entry_a_id),
        entryBId=str(entry_b_id),
        icebreaker=icebreaker,
        supabaseChannel=supabase_channel,
        createdAt=datetime.now(timezone.utc),
        expired=False,
        expiresAt=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    
    res = await rooms_collection.insert_one(new_room.model_dump(by_alias=True, exclude={"id"}))
    return res.inserted_id


@router.get("/{room_id}")
async def get_room(room_id: str, user_id: str = Depends(get_current_user_id)):
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room ID format")

    room = await rooms_collection.find_one({"_id": obj_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    if user_id not in [room["userAId"], room["userBId"]]:
        raise HTTPException(status_code=403, detail="Not a participant in this room")
        
    if room.get("expired"):
        return {"status": "expired"}
        
    return {
        "status": "active",
        "icebreaker": room["icebreaker"],
        "supabaseChannel": room["supabaseChannel"],
        "expiresAt": room["expiresAt"]
    }
