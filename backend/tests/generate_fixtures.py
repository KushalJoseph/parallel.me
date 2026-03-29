"""
Workflow 1 — Embedding Generation
==================================
Run this ONCE to populate fixtures.json with real Gemini embeddings.
After running, commit fixtures.json so tests never call Gemini again.

Usage (from backend/ directory):
    python tests/generate_fixtures.py

Requires:
    GEMINI_API_KEY in backend/.env or environment
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

FIXTURES_PATH = Path(__file__).parent / "fixtures.json"


def main():
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        print("ERROR: GEMINI_API_KEY not set in environment or .env")
        sys.exit(1)

    from google import genai

    client = genai.Client(api_key=gemini_key)

    with open(FIXTURES_PATH) as f:
        fixtures = json.load(f)

    pairs = fixtures["pairs"]
    total = sum(2 for _ in pairs)
    done = 0
    skipped = 0

    print(f"Generating embeddings for {total} prompts across {len(pairs)} pairs...\n")

    for pair in pairs:
        for side in ("a", "b"):
            entry = pair[side]
            label = f"{pair['id']}.{side}"

            if entry["embedding"] is not None:
                print(f"  [{label}] already embedded — skipping")
                skipped += 1
                done += 1
                continue

            print(f"  [{label}] embedding: \"{entry['text'][:60]}...\"")
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=entry["text"],
            )
            entry["embedding"] = list(response.embeddings[0].values)
            done += 1
            print(f"  [{label}] done  ({done}/{total})")

    with open(FIXTURES_PATH, "w") as f:
        json.dump(fixtures, f, indent=2)

    newly_generated = total - skipped
    print(f"\nDone. {newly_generated} new embeddings written to {FIXTURES_PATH}")
    print("You can now run: pytest tests/test_vector_match.py")


if __name__ == "__main__":
    main()
