
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from google import genai

from auth import get_current_user_id
from database import entries_collection
from models import Entry

import os
router = APIRouter(prefix="/api/entry", tags=["entry"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LAVA_SECRET_KEY = os.getenv("LAVA_SECRET_KEY")

class EntryRequest(BaseModel):
    text: str = Field(..., min_length=20, max_length=2000)

@router.post("")
async def submit_entry(req: EntryRequest, user_id: str = Depends(get_current_user_id)):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    client_ai = genai.Client(api_key=gemini_key)

    # 1. Embed directly via Gemini SDK (Lava unsupported)
    try:
        response = client_ai.models.embed_content(
            model='gemini-embedding-001',
            contents=req.text,
        )
        vector = response.embeddings[0].values
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    # 2. Store
    new_entry = Entry(
        userId=user_id,
        text=req.text,
        embedding=vector,
        matched=False,
        createdAt=datetime.now(timezone.utc)
    )
    
    result = await entries_collection.insert_one(new_entry.model_dump(by_alias=True, exclude={"id"}))
    entry_id = result.inserted_id

    # 3. Match
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": vector,
                "numCandidates": 50,
                "limit": 1,
                "filter": {
                    "matched": False,
                    "userId": {"$ne": user_id}
                }
            }
        },
        {
            "$project": {
                "embedding": 0,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]

    match_cursor = entries_collection.aggregate(pipeline)
    matches = await match_cursor.to_list(length=1)
    
    print("DEBUG VECTOR SEARCH MATCHES:", matches)

    # 4. Handle Match Results
    if matches and matches[0].get("score", 0) > 0.82:
        matched_entry = matches[0]
        # Avoid circular imports by importing inside function
        from routers.room import create_room_internal
        room_id = await create_room_internal(user_id, entry_id, matched_entry["userId"], matched_entry["_id"])
        
        return {"status": "matched", "roomId": str(room_id)}

    return {"status": "waiting", "entryId": str(entry_id)}
