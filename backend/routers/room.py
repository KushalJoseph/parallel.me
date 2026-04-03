import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import urllib.parse
import re

from auth import get_current_user_id
from database import rooms_collection, entries_collection
from models import Room, ChatMessage

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
    icebreakers = [
        "What's one thing you wish someone understood about your day today?",
        "If you could fast forward to tomorrow, what's the first thing you'd change?",
        "What's the heaviest thing you're carrying right now?",
        "If your day had a soundtrack, what song would be playing?",
        "What's a small win you haven't celebrated yet?",
        "Who is someone you wish you could talk to right now?",
        "What does 'peace' look like for you today?",
        "If you could give your past self one piece of advice this morning, what would it be?",
        "What's a feeling you're trying to ignore?",
        "How are you actually feeling, no filters?"
    ]

    if LAVA_SECRET_KEY and entry_a and entry_b:
        prompt = f"""
        Read these two anonymous diary entries and generate EXACTLY 10 empathetic opening questions that could connect these two strangers.
        Order the questions progressively: start with light/casual icebreakers and move towards deeper emotional questions based on their entries.
        Return ONLY the 10 questions, one per line. Do not include numbers, bullet points, introductory text, or quotes.
        Entry 1: {entry_a['text']}
        Entry 2: {entry_b['text']}
        """
        
        chat_endpoint = "https://api.lava.so/v1/chat/completions"
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    chat_endpoint,
                    headers={"Authorization": f"Bearer {LAVA_SECRET_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if text:
                        parsed = [
                            re.sub(r'^\d+[\.\)]\s*', '', line.strip()).strip().strip('"').strip("'")
                            for line in text.strip().split('\n') if line.strip()
                        ]
                        if parsed:
                            icebreakers = parsed
                else:
                    print(f"Lava Error: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"Lava request failed: {e}")
            
    # Initialize room with both users' secret prompts
    initial_messages = []
    if entry_a:
        initial_messages.append(ChatMessage(
            id=str(uuid.uuid4()),
            text=entry_a.get("raw_content") or entry_a.get("text", ""),
            senderId=user_a_id,
            isSystem=False,
            createdAt=datetime.now(timezone.utc)
        ))
    if entry_b:
        initial_messages.append(ChatMessage(
            id=str(uuid.uuid4()),
            text=entry_b.get("raw_content") or entry_b.get("text", ""),
            senderId=user_b_id,
            isSystem=False,
            createdAt=datetime.now(timezone.utc)
        ))

    # 4. Create Room
    supabase_channel = f"room-{uuid.uuid4()}"
    new_room = Room(
        userAId=user_a_id,
        userBId=user_b_id,
        entryAId=str(entry_a_id),
        entryBId=str(entry_b_id),
        icebreakers=icebreakers,
        titleA=entry_a.get("title") if entry_a else None,
        titleB=entry_b.get("title") if entry_b else None,
        supabaseChannel=supabase_channel,
        messages=initial_messages,
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
        "icebreakers": room.get("icebreakers", []),
        "supabaseChannel": room["supabaseChannel"],
        "expiresAt": room["expiresAt"].isoformat() + "Z" if room.get("expiresAt") else None,
        "userAId": room["userAId"],
        "userBId": room["userBId"],
        "userAConnected": room.get("userAConnected", False),
        "userBConnected": room.get("userBConnected", False),
        "isPermanent": room.get("isPermanent", False),
    }

from typing import Optional

class MessageInput(BaseModel):
    id: str
    text: str
    senderId: Optional[str] = None
    isSystem: Optional[bool] = False

@router.get("/{room_id}/messages")
async def get_messages(room_id: str, user_id: str = Depends(get_current_user_id)):
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room ID format")

    room = await rooms_collection.find_one(
        {"_id": obj_id},
        {"userAId": 1, "userBId": 1, "messages": 1},  # only fetch what we need
    )
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if user_id not in [room["userAId"], room["userBId"]]:
        raise HTTPException(status_code=403, detail="Not a participant in this room")

    return room.get("messages", [])

@router.post("/{room_id}/messages")
async def add_message(room_id: str, message: MessageInput, user_id: str = Depends(get_current_user_id)):
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room ID format")

    new_msg = message.model_dump()
    new_msg["createdAt"] = datetime.now(timezone.utc)

    # Auth check folded into the filter — one round-trip instead of two
    result = await rooms_collection.update_one(
        {"_id": obj_id, "$or": [{"userAId": user_id}, {"userBId": user_id}]},
        {"$push": {"messages": new_msg}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=403, detail="Not allowed")

    return {"status": "success"}

@router.post("/{room_id}/connect")
async def connect_room(room_id: str, user_id: str = Depends(get_current_user_id)):
    from bson.objectid import ObjectId
    from pymongo import ReturnDocument
    try:
        obj_id = ObjectId(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room ID format")

    room = await rooms_collection.find_one({"_id": obj_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    if user_id not in [room["userAId"], room["userBId"]]:
        raise HTTPException(status_code=403, detail="Not a participant in this room")

    is_user_a = (user_id == room["userAId"])
    update_field = "userAConnected" if is_user_a else "userBConnected"
    
    # We use find_one_and_update to reliably lock in the true states safely
    updated_room = await rooms_collection.find_one_and_update(
        {"_id": obj_id},
        {"$set": {update_field: True}},
        return_document=ReturnDocument.AFTER
    )
    
    is_perm = updated_room.get("userAConnected") and updated_room.get("userBConnected")
    
    # If this very request caused the mutual connect, trigger the permanent save!
    if is_perm and not updated_room.get("isPermanent"):
        system_msg = {
            "id": str(uuid.uuid4()),
            "text": "You're now connected! This chat has been saved.",
            "senderId": None,
            "isSystem": True,
            "createdAt": datetime.now(timezone.utc)
        }
        await rooms_collection.update_one(
            {"_id": obj_id},
            {"$set": {"isPermanent": True}, "$push": {"messages": system_msg}}
        )
        return {"isPermanent": True, "justConnected": True, "systemMsg": system_msg}

    return {"isPermanent": is_perm, "justConnected": False}

@router.delete("/{room_id}")
async def delete_room(room_id: str, user_id: str = Depends(get_current_user_id)):
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

    await rooms_collection.delete_one({"_id": obj_id})
    return {"status": "deleted"}
