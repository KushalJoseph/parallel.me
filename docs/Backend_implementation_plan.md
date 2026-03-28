# Parallel Me Backend Implementation Plan (FastAPI)

The backend for Parallel Me will act as the orchestrator/glue between various managed services. Originally architected for Next.js, this plan adapts the system to a clean, asynchronous Python FastAPI architecture.

## 1. Provider Assignments & Python Stack

| Job                 | Provider                        | Python / FastAPI Implementation                                            |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| **Framework**       | FastAPI                         | `fastapi`, `uvicorn` (ASGI server)                                         |
| **Auth**            | Auth0                           | Custom FastAPI dependency to validate Auth0 JWTs (`pyjwt`, `cryptography`) |
| **Database**        | MongoDB Atlas                   | `motor` (Async MongoDB driver for Python)                                  |
| **Vector search**   | MongoDB                         | Atlas Vector Search (`$vectorSearch` aggregation via Motor)                |
| **Realtime chat**   | Supabase                        | Supabase handles sockets. FastAPI will assign users a Supabase token.      |
| **Embeddings**      | Gemini (`gemini-embedding-001`) | `google-genai` Python SDK                                                  |
| **Icebreaker LLM**  | Gemini 1.5 Flash                | `google-genai` Python SDK                                                  |
| **Voice**           | ElevenLabs                      | `elevenlabs-python` SDK                                                    |
| **Background Jobs** | APScheduler / generic           | `APScheduler` or FastAPI `BackgroundTasks` for Guardian & Expiry tasks     |

---

## 2. Authentication (Auth0 + FastAPI)

Instead of the Next.js SDK, we will use a FastAPI dependency that verifies the bearer token from Auth0 on protected routes.

1. **Setup**: The client handles login via Auth0 Universal Login and receives an Access Token.
2. **Backend Validation**: The client sends the Bearer token in the `Authorization` header.
3. **Dependency (`get_current_user`)**:
   - Fetches Auth0 JWKS (JSON Web Key Set).
   - Validates the token signature and expiration.
   - Extracts the `sub` (user ID) from the token payload.
   - Returns the `userId` to the endpoint.

---

## 3. Data Models (Pydantic & MongoDB)

The database will consist of three collections: `entries`, `rooms`, and `reports`.

### `entries`

```python
class Entry(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    userId: str  # Auth0 sub
    text: str
    embedding: List[float]  # 768-dim float array
    matched: bool = False
    isSeeded: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)
```

### `rooms`

```python
class Room(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    userAId: str
    userBId: str
    entryAId: PyObjectId
    entryBId: PyObjectId
    icebreaker: str
    voiceUrl: str
    supabaseChannel: str  # e.g., "room-<roomId>"
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    expired: bool = False
    expiresAt: datetime
    guardianAlert: bool = False
    reportedAt: Optional[datetime] = None
    reportReason: Optional[str] = None
```

### `reports`

```python
class Report(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id")
    userId: str
    roomId: PyObjectId
    reason: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
```

---

## 4. API Endpoints

All endpoints require authentication (the `get_current_user` dependency) except where noted.

### `POST /api/entry`

**What it does:** Receives entry, embeds it, stores it, and attempts a vector match.
**Request Body:** `{"text": "string (20-2000 chars)"}`
**Logic:**

1. Validate text length. Rate limit using a fast cache (e.g., Redis or in-memory) or DB query to ensure 1 submission per hour per user.
2. Call Gemini `gemini-embedding-001` to generate a 768-dim embedding.
3. Insert entry into `entries` collection.
4. Run `$vectorSearch` via Motor to find the nearest unmatched entry (`matched: false`, `userId != current_user`, `isSeeded: False` initially).
5. If match found (cosine sim > 0.82): Do internal creation of Room (similar to `/api/room` logic).
6. If no match: Return `{"status": "waiting", "entryId": "<id>"}`. Wait for client to poll or send another entry later.
   **Returns:** `{"status": "waiting" | "matched", "entryId" | "roomId"}`

### `POST /api/entry/seed-check` (Fallback Polling or background process)

If a user is waiting for 30 seconds, the frontend can call this endpoint to trigger a match including `isSeeded: True` entries to guarantee a match.

### `POST /api/room` (Internal/Callable)

**What it does:** Finalizes match, creates room, generates icebreaker and voice.
**Logic:**

1. Marks both entries as `matched: True`.
2. Calls Gemini 1.5 Flash with both diary entries to generate 1 empathetic opening question.
3. Calls ElevenLabs TTS with the generated question. Saves audio (to S3 or returns base64).
4. Inserts a new Room into MongoDB with a `expiresAt` set to `now + 24 hours`.
   **Returns:** `{"roomId": "...", "icebreaker": "...", "voiceUrl": "...", "supabaseChannel": "..."}`

### `GET /api/room/{roomId}`

**What it does:** Poll endpoint for the frontend to get room status.
**Logic:**

1. Verify `current_user` is either `userAId` or `userBId` (returns 403 otherwise).
2. If room is expired, return `{"status": "expired"}`.
3. If active, return room details.
   **Returns:** `{"status": "active" | "expired", "icebreaker": "...", "expiresAt": "...", "supabaseChannel": "..."}`

## 5. Background Jobs (The Guardian & Expiry)

Instead of Supabase Edge Functions, we can run these natively in the Python environment using `APScheduler`.

### Expiry Job (Runs every 1 minute)

- **Query:** Find all rooms where `expiresAt < now` and `expired == False`.
- **Action:** Update `expired = True`.

### Agentic Guardian Job (Runs every 5 minutes)

- **Dependencies:** Uses Supabase Python Client (`supabase-py`) to read messages.
- **Query:** For each active room (`expired == False`):
  1. Fetch last 10 messages from Supabase `messages` table.
  2. If last message > 15 mins ago: Call Gemini to generate a gentle re-engagement question based on the entries and conversation. Insert message into Supabase with sender "guardian".
  3. Call Gemini to check for distress signals. If yes (severity >= 2), post a crisis resource link and flag room in MongoDB (`guardianAlert = True`).

---

## 6. Seed Pool Script

Create `scripts/seed.py` that:

1. Connects to MongoDB.
2. Takes an array of 20 predefined empathetic sentences/entries.
3. Calls Gemini to generate embeddings for all 20.
4. Inserts them into `entries` with `isSeeded: True` and `userId: "seed_bot"`.

---

## 7. Environment Variables (`.env`)

```env
# API Config
PORT=8000
ENVIRONMENT=development

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_API_AUDIENCE=your-api-audience

# MongoDB
MONGODB_URI=mongodb+srv://...

# Supabase
SUPABASE_URL=...
SUPABASE_KEY=... # Service role key for Guardian access

# LLM & Voice Providers
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## 8. Development Steps

1. **Setup (`poetry` or `pip`)**: Install `fastapi`, `uvicorn`, `motor`, `google-genai`, `elevenlabs`, `pydantic`, `pyjwt`, `apscheduler`, `supabase`.
2. **Auth0 Middleware**: Implement JWT validation dependency.
3. **MongoDB Connection**: Setup `motor` client and define Pydantic models. Create Atlas Vector Index manually in UI.
4. **Seed Database**: Write and run `seed.py`.
5. **Endpoints Implementation**: Write `/api/entry` and `/api/room` matching logic.
6. **Room Status Handling**: Write `/api/room/{roomId}` and `/api/report`.
7. **Background Jobs**: Setup APScheduler for Expiry and Guardian functions.
