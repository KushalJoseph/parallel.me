import json
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from auth import get_current_user_id
from database import entries_collection, rooms_collection
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from models import Entry
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/entry", tags=["entry"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LAVA_SECRET_KEY = os.getenv("LAVA_SECRET_KEY")

ENRICHMENT_SYSTEM_PROMPT = """\
You are a semantic enrichment engine. Take the user's raw input and compress it into a single, dense 2-3 sentence paragraph that captures:
- The core subject or event
- Their emotional state and underlying struggle
- Their implicit intent or craving

Output a strict JSON object with a single key: "enriched_context".
The value must be concise (2-3 sentences max), precise, and semantically rich — it will be used as a vector embedding.

Do not pad, elaborate, or repeat. Output ONLY the raw JSON object.

USER INPUT:
"{insert_user_text_here}"
"""

LAVA_ENDPOINT = "https://api.lava.so/v1/chat/completions"


async def enrich_user_message(raw_text: str) -> tuple[str, str | None]:
    """
    Calls Lava (gpt-4o-mini) to semantically enrich raw_text.

    Returns:
        (text_to_embed, enriched_content)
        - text_to_embed: enriched paragraph if successful, else raw_text (fallback)
        - enriched_content: enriched paragraph string, or None on failure
    """
    if not LAVA_SECRET_KEY:
        logger.warning(
            "LAVA_SECRET_KEY not set — skipping enrichment, embedding raw text."
        )
        return raw_text, None

    prompt = ENRICHMENT_SYSTEM_PROMPT.replace("{insert_user_text_here}", raw_text)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                LAVA_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {LAVA_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )

        if resp.status_code != 200:
            logger.warning(
                f"Lava enrichment error {resp.status_code}: {resp.text} — falling back to raw text."
            )
            return raw_text, None

        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            logger.warning("Lava returned empty content — falling back to raw text.")
            return raw_text, None

        parsed = json.loads(content)
        enriched = parsed.get("enriched_context", "").strip()
        if not enriched:
            logger.warning(
                "Lava JSON missing 'enriched_context' key — falling back to raw text."
            )
            return raw_text, None

        return enriched, enriched

    except json.JSONDecodeError as e:
        logger.warning(f"Lava returned malformed JSON: {e} — falling back to raw text.")
        return raw_text, None
    except Exception as e:
        logger.warning(
            f"Lava enrichment request failed: {e} — falling back to raw text."
        )
        return raw_text, None


class EntryRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=200000)


@router.post("")
async def submit_entry(req: EntryRequest, user_id: str = Depends(get_current_user_id)):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    client_ai = genai.Client(api_key=gemini_key)

    # 1. Enrich raw text via Lava before embedding
    text_to_embed, enriched_content = await enrich_user_message(req.text)

    # 2. Embed enriched text (falls back to raw text automatically if enrichment failed)
    try:
        response = client_ai.models.embed_content(
            model="gemini-embedding-001",
            contents=text_to_embed,
        )
        vector = response.embeddings[0].values
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    # 3. Store raw_content, enriched_content, and embedding
    new_entry = Entry(
        userId=user_id,
        text=req.text,  # kept for backward compatibility
        raw_content=req.text,
        enriched_content=enriched_content,  # None if Lava call failed
        embedding=vector,
        matched=False,
        createdAt=datetime.now(timezone.utc),
    )

    result = await entries_collection.insert_one(
        new_entry.model_dump(by_alias=True, exclude={"id"})
    )
    entry_id = result.inserted_id

    # 4. Vector search for a match
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": vector,
                "numCandidates": 50,
                "limit": 1,
                "filter": {"matched": False, "userId": {"$ne": user_id}},
            }
        },
        {"$project": {"embedding": 0, "score": {"$meta": "vectorSearchScore"}}},
    ]

    match_cursor = entries_collection.aggregate(pipeline)
    matches = await match_cursor.to_list(length=1)

    print("DEBUG VECTOR SEARCH MATCHES:", matches)

    # 5. Handle Match Results
    if matches and matches[0].get("score", 0) > 0.82:
        matched_entry = matches[0]
        from routers.room import create_room_internal

        room_id = await create_room_internal(
            user_id, entry_id, matched_entry["userId"], matched_entry["_id"]
        )

        return {"status": "matched", "roomId": str(room_id)}

    return {"status": "waiting", "entryId": str(entry_id)}


@router.get("/{entry_id}")
async def get_entry_status(entry_id: str, user_id: str = Depends(get_current_user_id)):
    from bson.objectid import ObjectId

    try:
        obj_id = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    entry = await entries_collection.find_one({"_id": obj_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.get("userId") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this entry")

    if not entry.get("matched"):
        return {"status": "waiting"}

    # If matched, find the room where this entry was involved
    room = await rooms_collection.find_one(
        {"$or": [{"entryAId": str(entry_id)}, {"entryBId": str(entry_id)}]}
    )

    if not room:
        # Edge case: marked matched but room hasn't been created yet
        return {"status": "waiting"}

    return {"status": "matched", "roomId": str(room["_id"])}
