"""
Workflow 2 — Vector Search Integration Tests
=============================================
Tests the MongoDB Atlas $vectorSearch pipeline and the 0.82 match threshold.
No Gemini calls, no Lava calls, no FastAPI server required.

Pre-requisite: run generate_fixtures.py once to populate embeddings in fixtures.json.

Usage (from backend/ directory):
    python -m pytest tests/test_vector_match.py -v

All test entries are tagged with userId prefix "test_parallel_" and deleted
from Atlas at the end of the session (see conftest.py).
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest

FIXTURES_PATH = Path(__file__).parent / "fixtures.json"
THRESHOLD = 0.82
TEST_USER_PREFIX = "test_parallel_"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_fixtures():
    with open(FIXTURES_PATH) as f:
        return json.load(f)


def _all_embedded(fixtures):
    return all(
        pair[side]["embedding"] is not None
        for pair in fixtures["pairs"]
        for side in ("a", "b")
    )


def _pair(fixtures, pair_id):
    return next(p for p in fixtures["pairs"] if p["id"] == pair_id)


async def _insert_entry(collection, embedding, user_id, matched=False):
    doc = {
        "userId": user_id,
        "text": "test entry",
        "raw_content": "test entry",
        "embedding": list(embedding),
        "matched": matched,
        "isSeeded": False,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await collection.insert_one(doc)
    return result.inserted_id


async def _find_score(collection, query_vector, exclude_user_id, target_id, max_wait=15, interval=2):
    """
    Run the production vector search pipeline and return the score for
    target_id if it appears in the top-20 results, else None.

    Retries up to max_wait seconds because Atlas Vector Search has a small
    indexing lag — the document exists in the collection before it appears
    in the vector index.
    """
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": list(query_vector),
                "numCandidates": 100,
                "limit": 20,
                "filter": {
                    "matched": False,
                    "userId": {"$ne": exclude_user_id},
                },
            }
        },
        {"$project": {"embedding": 0, "score": {"$meta": "vectorSearchScore"}}},
    ]

    elapsed = 0
    while elapsed <= max_wait:
        results = await collection.aggregate(pipeline).to_list(20)
        for r in results:
            if r["_id"] == target_id:
                return r["score"]
        await asyncio.sleep(interval)
        elapsed += interval

    return None  # not indexed within max_wait seconds


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def fx():
    data = load_fixtures()
    if not _all_embedded(data):
        pytest.skip(
            "Embeddings not yet generated. "
            "Run: python tests/generate_fixtures.py"
        )
    return data


# ---------------------------------------------------------------------------
# Tests: matching behaviour
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("pair_id", ["grief_pair", "anxiety_pair", "burnout_pair", "loneliness_pair"])
async def test_similar_prompts_should_match(fx, collection, pair_id):
    pair = _pair(fx, pair_id)
    user_a = f"{TEST_USER_PREFIX}A_{uuid.uuid4().hex}"
    user_b = f"{TEST_USER_PREFIX}B_{uuid.uuid4().hex}"

    entry_b_id = await _insert_entry(collection, pair["b"]["embedding"], user_b)
    score = await _find_score(collection, pair["a"]["embedding"], user_a, entry_b_id)

    print(f"\n  score = {score:.4f}" if score is not None else "\n  score = None (not indexed)")
    assert score is not None, (
        f"[{pair_id}] Entry B not found in top-20 results — "
        f"similarity is too low to even be a candidate."
    )
    assert score > THRESHOLD, (
        f"[{pair_id}] Expected score > {THRESHOLD}, got {score:.4f}"
    )


@pytest.mark.parametrize("pair_id", ["grief_vs_joy", "anxiety_vs_joy", "burnout_vs_loneliness"])
async def test_dissimilar_prompts_should_not_match(fx, collection, pair_id):
    pair = _pair(fx, pair_id)
    user_a = f"{TEST_USER_PREFIX}A_{uuid.uuid4().hex}"
    user_b = f"{TEST_USER_PREFIX}B_{uuid.uuid4().hex}"

    entry_b_id = await _insert_entry(collection, pair["b"]["embedding"], user_b)
    score = await _find_score(collection, pair["a"]["embedding"], user_a, entry_b_id)

    print(f"\n  score = {score:.4f}" if score is not None else "\n  score = None (not indexed)")
    # None means not even in top-20 — definitely no match
    if score is not None:
        assert score <= THRESHOLD, (
            f"[{pair_id}] Expected score <= {THRESHOLD}, got {score:.4f}"
        )


# ---------------------------------------------------------------------------
# Tests: pipeline filter correctness
# ---------------------------------------------------------------------------

async def test_same_user_is_excluded(fx, collection):
    """A user's own entry must never be returned as a match."""
    pair = _pair(fx, "grief_pair")
    same_user = f"{TEST_USER_PREFIX}same_{uuid.uuid4().hex}"

    entry_b_id = await _insert_entry(collection, pair["b"]["embedding"], same_user)
    score = await _find_score(collection, pair["a"]["embedding"], same_user, entry_b_id)

    assert score is None, (
        f"Same-user entry should be excluded by the userId filter but got score {score:.4f}"
    )


async def test_already_matched_entry_is_excluded(fx, collection):
    """Entries with matched=True must be excluded from the search pool."""
    pair = _pair(fx, "grief_pair")
    user_a = f"{TEST_USER_PREFIX}A_{uuid.uuid4().hex}"
    user_b = f"{TEST_USER_PREFIX}B_{uuid.uuid4().hex}"

    entry_b_id = await _insert_entry(
        collection, pair["b"]["embedding"], user_b, matched=True
    )
    score = await _find_score(collection, pair["a"]["embedding"], user_a, entry_b_id)

    assert score is None, (
        f"matched=True entry should be excluded but got score {score:.4f}"
    )
