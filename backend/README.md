# Parallel Me — Backend

This is the **FastAPI backend** for Parallel Me. It acts as a stateless orchestrator: it validates identity (Auth0), generates AI embeddings (Gemini), runs semantic vector matching (MongoDB Atlas), generates empathetic conversation starters (Lava / GPT-4o-mini), and creates temporary chat rooms. Real-time messaging bypasses this server entirely, going directly through Supabase Realtime on the frontend.

---

## Quick Start

```bash
# 1. Create and activate the virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create your .env file from the example
cp .env.example .env
# Fill in your values (see Environment Variables section below)

# 4. Run the dev server
uvicorn main:app --reload --port 8000
```

API docs are served automatically at `http://localhost:8000/docs`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the following keys:

| Variable              | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `PORT`                | Port to run the server on (default `8000`)                  |
| `ENVIRONMENT`         | `development` or `production`                               |
| `TESTING`             | `true` bypasses Auth0 for local dev (see Auth section)      |
| `AUTH0_DOMAIN`        | Your Auth0 tenant domain, e.g. `dev-xxx.us.auth0.com`       |
| `AUTH0_API_AUDIENCE`  | Your Auth0 API Audience URL                                 |
| `AUTH0_CLIENT_ID`     | Your Auth0 Application Client ID                            |
| `AUTH0_CLIENT_SECRET` | Your Auth0 Application Client Secret                        |
| `AUTH0_SECRET`        | Any random secret string for session signing                |
| `AUTH0_REDIRECT_URI`  | Callback URL, e.g. `http://localhost:8000/callback`         |
| `MONGODB_URI`         | MongoDB Atlas connection string                             |
| `SUPABASE_URL`        | Your Supabase project URL                                   |
| `SUPABASE_KEY`        | Your Supabase service role key                              |
| `GEMINI_API_KEY`      | Google AI Studio API key, used for `gemini-embedding-001`   |
| `LAVA_SECRET_KEY`     | Lava proxy API key, used for `gpt-4o-mini` chat completions |

---

## Authentication

The backend uses **Auth0** with **JWT Bearer Tokens** (RS256) to protect all `/api/*` routes.

### How It Works

Every protected route declares the `get_current_user_id` dependency. When a request arrives:

1. The `HTTPBearer` scheme extracts the `Authorization: Bearer <token>` header.
2. `auth.py` fetches Auth0's public JWKS keys (`/.well-known/jwks.json`) and uses them to cryptographically verify the token's RS256 signature.
3. The `sub` claim is extracted from the decoded payload and becomes the `user_id` for that request.
4. If the token is missing, expired, or has an invalid signature, the request is rejected with `401 Unauthorized`.

### Setting Up Auth0

1. Go to [auth0.com](https://auth0.com) and create a new **Regular Web Application**.
2. Set **Allowed Callback URLs** to `http://localhost:8000/callback`.
3. Set **Allowed Logout URLs** to `http://localhost:8000`.
4. Go to **APIs** and create a new API. Set the **Identifier** — this becomes your `AUTH0_API_AUDIENCE`.
5. Fill your `.env` with `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` from the application settings.

### Getting a Real JWT for Testing

1. Ensure `TESTING=false` in `.env` and restart the server.
2. Visit `http://localhost:8000/login` in your browser.
3. Complete the Auth0 login flow.
4. You will be redirected to `http://localhost:8000/profile` which displays raw JSON.
5. Copy the `access_token` value from that JSON.
6. In Postman, go to **Authorization → Bearer Token** and paste it.

### Testing Bypass (`TESTING=true`)

Set `TESTING=true` in `.env`. Any request with `Authorization: Bearer test-token` will be automatically assigned to the mock user `test-user-123`, skipping all Auth0 JWT verification entirely. **Never deploy with this enabled.**

---

## MongoDB Atlas Setup

This backend uses **MongoDB Atlas Vector Search** for semantic matching. Before the matching endpoint will work, you must create a Vector Search Index manually:

1. In Atlas, open your `parallel_me` database → `entries` collection → **Atlas Search** tab.
2. Click **Create Search Index → JSON Editor**.
3. Set the index name to `vector_index` and paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "matched" },
    { "type": "filter", "path": "userId" }
  ]
}
```

4. Click **Create**. Wait ~60 seconds for status to turn **Active**.

---

## API Routes

### `POST /api/entry`

The core matching endpoint.

**Auth required:** Yes  
**Request Body:**

```json
{ "text": "My diary entry (20–2000 characters)" }
```

**Internal Logic:**

1. Uses the Google Gemini SDK (`gemini-embedding-001`) to generate a 3072-dimensional semantic vector from the entry text.
2. Saves the entry document (`userId`, `text`, `embedding`, `matched: false`, `createdAt`) to the `entries` MongoDB collection.
3. Immediately runs a `$vectorSearch` aggregation pipeline against all other entries where `matched: false` and `userId != current_user`. Uses cosine similarity across the 3072-dim space.
4. **If a match is found** (cosine score `> 0.82`): calls `create_room_internal()` to atomically lock both entries, generate an icebreaker, and create a Room document. Returns `{"status": "matched", "roomId": "..."}`.
5. **If no match is found:** returns `{"status": "waiting", "entryId": "..."}`. The frontend is expected to poll or retry later.

---

### `GET /api/room/{room_id}`

Retrieves a room's details for an authenticated participant.

**Auth required:** Yes  
**Path Parameter:** `room_id` — MongoDB ObjectId string

**Internal Logic:**

1. Validates the `room_id` format.
2. Fetches the Room document from MongoDB.
3. **Authorization check:** verifies the authenticated `user_id` matches either `userAId` or `userBId` in the room. Returns `403` if not.
4. If `expired: true`, returns `{"status": "expired"}`.
5. Otherwise returns the active room details.

**Response:**

```json
{
  "status": "active",
  "icebreaker": "What made you feel most seen today?",
  "supabaseChannel": "room-<uuid>",
  "expiresAt": "2026-03-29T20:00:00Z"
}
```

---

### Web Auth Routes (Local Testing Only)

These browser-based routes exist solely for local development to obtain a real Auth0 JWT without external tooling. They are not called by the production frontend.

| Route           | Description                                          |
| --------------- | ---------------------------------------------------- |
| `GET /login`    | Redirects to Auth0 Universal Login page              |
| `GET /callback` | Handles the OAuth2 code exchange and sets session    |
| `GET /profile`  | Displays raw session data (including `access_token`) |
| `GET /logout`   | Clears session and redirects to Auth0 logout         |

---

## Internal Functions

### `create_room_internal()` (in `routers/room.py`)

Called by `POST /api/entry` after a successful vector match. Not a public HTTP route — it is an internal async function.

1. **Marks both entries** as `matched: true` in MongoDB (prevents them from being matched again).
2. **Generates an AI Icebreaker** by posting both entry texts to the Lava API (`gpt-4o-mini`). If Lava fails, falls back to a hardcoded default question.
3. **Creates the Room document** with a unique `supabaseChannel` UUID, sets `expiresAt` to 24 hours from now.
4. Returns the new `room_id` to the caller.

---

## Background Jobs (`jobs.py`)

Two async jobs run on startup via **APScheduler**:

| Job                  | Interval        | What it does                                                                                    |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `expire_rooms_job`   | Every 1 minute  | Queries MongoDB for rooms where `expiresAt < now` and `expired: false`, and marks them expired. |
| `guardian_agent_job` | Every 5 minutes | Scaffold for a future AI moderation agent. Currently a no-op.                                   |

---

## File Structure

```
backend/
├── main.py              # FastAPI app entry point, middleware, router registration
├── auth.py              # Auth0 JWT verification dependency + web SDK setup
├── database.py          # Motor (async MongoDB) client and collection references
├── models.py            # Pydantic models: Entry, Room, Report
├── jobs.py              # APScheduler background jobs (room expiry, guardian)
├── requirements.txt     # Python dependencies
├── .env                 # Local secrets (gitignored)
├── .env.example         # Template for .env keys
├── .gitignore
└── routers/
    ├── entry.py         # POST /api/entry — embedding + vector matching
    ├── room.py          # GET /api/room/{id} + create_room_internal()
    └── auth_web.py      # GET /login, /callback, /profile, /logout (local dev only)
```

---

## Database Collections

All collections live in the `parallel_me` database on MongoDB Atlas.

| Collection | Purpose                                                     |
| ---------- | ----------------------------------------------------------- |
| `entries`  | User diary entries with 3072-dim embeddings and match state |
| `rooms`    | Active/expired chat rooms linking two matched users         |
