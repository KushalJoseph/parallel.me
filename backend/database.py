import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGODB_URI)
db = client.parallel_me  # Database name

# Collections
entries_collection = db.get_collection("entries")
rooms_collection = db.get_collection("rooms")
