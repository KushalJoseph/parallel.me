from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from auth import get_current_user_id
from database import entries_collection, rooms_collection

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/conversations")
async def get_user_conversations(user_id: str = Depends(get_current_user_id)):
    """
    Returns all pending entries (< 24h old, unmatched) and all active rooms
    for the current user, sorted by createdAt descending.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # --- Pending entries ---
    entry_cursor = entries_collection.find(
        {
            "userId": user_id,
            "matched": False,
            "isSeeded": {"$ne": True},
            "createdAt": {"$gte": cutoff},
        },
        {"embedding": 0},  # exclude large vector field
    )
    raw_entries = await entry_cursor.to_list(length=100)

    pending = [
        {
            "type": "pending",
            "entryId": str(e["_id"]),
            "title": e.get("title") or "Untitled",
            "createdAt": e["createdAt"].isoformat() + "Z",
        }
        for e in raw_entries
    ]

    # --- Active rooms ---
    room_cursor = rooms_collection.find(
        {
            "$or": [{"userAId": user_id}, {"userBId": user_id}],
            "expired": False,
        }
    )
    raw_rooms = await room_cursor.to_list(length=100)

    active = []
    for r in raw_rooms:
        # Prefer the per-user title stored at room creation; fall back to icebreaker; then "Untitled"
        if r.get("userAId") == user_id:
            title = r.get("titleA")
        else:
            title = r.get("titleB")

        if not title:
            title = r.get("icebreaker") or "Untitled"

        icebreaker = r.get("icebreaker", "")
        icebreaker_preview = icebreaker[:60] + ("..." if len(icebreaker) > 60 else "")

        active.append(
            {
                "type": "active",
                "roomId": str(r["_id"]),
                "title": title,
                "icebreakerPreview": icebreaker_preview,
                "expiresAt": r["expiresAt"].isoformat() + "Z",
                "createdAt": r["createdAt"].isoformat() + "Z",
                "isPermanent": r.get("isPermanent", False),
            }
        )

    all_convos = pending + active
    all_convos.sort(key=lambda x: x["createdAt"], reverse=True)
    return all_convos
