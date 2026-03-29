from pydantic import BaseModel, Field, ConfigDict
from pydantic.functional_validators import BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime, timezone

# Ensure PyObjectId works with ObjectId strings gracefully in Pydantic V2
PyObjectId = Annotated[str, BeforeValidator(str)]

def get_utcnow():
    return datetime.now(timezone.utc)

class Entry(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    userId: str
    text: str                                   # kept for backward compatibility
    raw_content: str                            # original unmodified user message
    enriched_content: Optional[str] = None     # Lava-enriched paragraph (null on failure)
    embedding: List[float]
    matched: bool = False
    isSeeded: bool = False
    title: Optional[str] = None                # Lava-generated 2-5 word evocative title
    createdAt: datetime = Field(default_factory=get_utcnow)

    model_config = ConfigDict(populate_by_name=True)

class ChatMessage(BaseModel):
    id: str
    text: str
    senderId: Optional[str] = None
    isSystem: Optional[bool] = False
    createdAt: datetime = Field(default_factory=get_utcnow)

class Room(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    userAId: str
    userBId: str
    entryAId: PyObjectId
    entryBId: PyObjectId
    icebreaker: str
    supabaseChannel: str
    messages: List[ChatMessage] = Field(default_factory=list)
    createdAt: datetime = Field(default_factory=get_utcnow)
    expired: bool = False
    expiresAt: datetime
    userAConnected: bool = False
    userBConnected: bool = False
    isPermanent: bool = False
    guardianAlert: bool = False
    reportedAt: Optional[datetime] = None
    reportReason: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

