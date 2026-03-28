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
    text: str
    embedding: List[float]
    matched: bool = False
    isSeeded: bool = False
    createdAt: datetime = Field(default_factory=get_utcnow)

    model_config = ConfigDict(populate_by_name=True)

class Room(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    userAId: str
    userBId: str
    entryAId: PyObjectId
    entryBId: PyObjectId
    icebreaker: str
    supabaseChannel: str
    createdAt: datetime = Field(default_factory=get_utcnow)
    expired: bool = False
    expiresAt: datetime
    guardianAlert: bool = False
    reportedAt: Optional[datetime] = None
    reportReason: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

