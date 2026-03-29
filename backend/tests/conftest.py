import os

import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

TEST_USER_PREFIX = "test_parallel_"


@pytest_asyncio.fixture
async def collection():
    """
    Function-scoped: fresh Motor client per test avoids event-loop-closed errors.
    Cleans up all test_parallel_ entries from Atlas after each test.
    """
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(uri)
    col = client.parallel_me.entries

    yield col

    result = await col.delete_many({"userId": {"$regex": f"^{TEST_USER_PREFIX}"}})
    print(f"\n[cleanup] Deleted {result.deleted_count} test entries from Atlas.")
    client.close()
