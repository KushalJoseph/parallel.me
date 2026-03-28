# Backend — High Level

---

## The Principle

You are not building infrastructure. You are gluing providers together. Every job has an owner. You write the glue.

---

## Provider Assignments

| Job | Provider | You build |
|-----|----------|-----------|
| Auth | Auth0 | Middleware wrapper + session check |
| Database | MongoDB Atlas | Nothing. Hosted, managed. |
| Vector search | MongoDB Atlas | One index in the UI, done. |
| Realtime chat | Supabase Realtime | Nothing. They manage the socket. |
| Embeddings | Gemini `gemini-embedding-001` | One API call. |
| Icebreaker LLM | Gemini 1.5 Flash | One API call. |
| Voice | ElevenLabs | One API call. |
| Expiry | Supabase scheduled functions | ~10 lines. |
| Guardian agent | Gemini 1.5 Flash | One function, runs on a timer. |

---

## Full Route Map

```
Auth (Auth0-managed, no custom logic)
  GET  /api/auth/login          ← redirect to Auth0 Universal Login
  GET  /api/auth/callback       ← Auth0 redirects here after login
  GET  /api/auth/logout         ← clear session, redirect to home
  GET  /api/auth/me             ← return current session user (or 401)

Entry & Matching
  POST /api/entry               ← submit diary entry, embed, store, attempt match

Room
  POST /api/room                ← create room, generate icebreaker, trigger voice
  GET  /api/room/:id            ← poll room status: waiting / active / expired
  DELETE /api/room/:id          ← soft-delete (admin / expiry cron only)

Safety
  POST /api/report              ← flag a room, immediately marks it expired
```

Every route except the auth callback requires a valid session. One middleware function handles this.

---

## Authentication — How It Actually Works

Auth0 is drop-in. You use their Next.js SDK (`@auth0/nextjs-auth0`).

### Setup (one-time, ~30 minutes)

1. Create Auth0 application → type: Regular Web Application
2. Set **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`, `https://your-domain/api/auth/callback`
3. Set **Allowed Logout URLs**: `http://localhost:3000`, `https://your-domain`
4. Copy `AUTH0_SECRET`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` to `.env.local`
5. Create `pages/api/auth/[...auth0].ts` — three lines, done forever:

```ts
// pages/api/auth/[...auth0].ts
import { handleAuth } from '@auth0/nextjs-auth0';
export default handleAuth();
```

This single file handles `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, and `/api/auth/me` automatically.

### Session Shape

Auth0 injects a session into every request. The session contains:

```ts
{
  user: {
    sub: "auth0|abc123",   // your stable user ID — use this everywhere
    email: "user@example.com",
    name: "...",
    picture: "...",
  }
}
```

Use `user.sub` as the `userId` stored in MongoDB entries and rooms. Never store email.

### Protecting Routes — One Middleware Wrapper

Wrap every custom API route with `withApiAuthRequired`:

```ts
// lib/withAuth.ts
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
export { withApiAuthRequired, getSession };
```

Usage:

```ts
// pages/api/entry.ts
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async (req, res) => {
  const session = await getSession(req, res);
  const userId = session.user.sub;
  // ... rest of handler
});
```

Any request without a valid session returns `401` automatically. You never write auth checks manually.

---

## Route Specifications

### `POST /api/entry`

**What it does:** Receives a diary entry. Embeds it. Stores it. Attempts a vector match.

**Auth:** Required.

**Request body:**
```json
{ "text": "string, 20–2000 chars" }
```

**Flow:**
```
1. Validate: text must be 20–2000 chars
2. Embed: call Gemini gemini-embedding-001 → float[] (768 dims)
3. Store in MongoDB entries: { userId, text, embedding, matched: false, isSeeded: false, createdAt }
4. Query MongoDB vector index: find nearest unmatched, non-same-user entry
   - If match found (cosine similarity > 0.82): call POST /api/room internally
   - If no match: return { status: "waiting", entryId }
5. After 30s (handled client-side polling): re-attempt match including seeded entries
```

**Response (waiting):**
```json
{ "status": "waiting", "entryId": "..." }
```

**Response (matched):**
```json
{ "status": "matched", "roomId": "..." }
```

**Error responses:**
- `400` — text too short/long
- `401` — not authenticated
- `500` — embedding or DB failure (log and return generic message)

---

### `POST /api/room`

**What it does:** Creates a room record, generates an AI icebreaker, triggers ElevenLabs voice synthesis.

**Auth:** Required (called internally from `/api/entry`, but can be called directly).

**Request body:**
```json
{ "entryIdA": "...", "entryIdB": "..." }
```

**Flow:**
```
1. Fetch both entries from MongoDB
2. Mark both entries as matched: true
3. Call Gemini 1.5 Flash: read both entry texts, generate one empathetic opening question
4. Call ElevenLabs TTS: convert icebreaker text → MP3 → store URL (or base64)
5. Create Supabase Realtime channel: channel name = roomId
6. Insert room into MongoDB: { userAId, userBId, entryAId, entryBId, icebreaker, voiceUrl, supabaseChannel, createdAt, expired: false }
7. Return roomId
```

**Response:**
```json
{
  "roomId": "...",
  "icebreaker": "string",
  "voiceUrl": "string",
  "supabaseChannel": "room-{roomId}"
}
```

---

### `GET /api/room/:id`

**What it does:** Returns current room status. The client polls this every 10s.

**Auth:** Required. User must be a participant (userAId or userBId).

**Response (active):**
```json
{
  "status": "active",
  "icebreaker": "...",
  "voiceUrl": "...",
  "supabaseChannel": "room-{id}",
  "expiresAt": "ISO timestamp",
  "otherUser": { "initials": "S" }
}
```

**Response (waiting — no match yet):**
```json
{ "status": "waiting" }
```

**Response (expired):**
```json
{ "status": "expired" }
```

**Error responses:**
- `403` — authenticated but not a participant in this room
- `404` — room not found

---

### `POST /api/report`

**What it does:** Safety valve. Immediately marks the room as expired and logs the report.

**Auth:** Required. User must be a participant.

**Request body:**
```json
{ "roomId": "...", "reason": "harassment | spam | distress | other" }
```

**Flow:**
```
1. Verify user is participant
2. Set room.expired = true, room.reportedAt = now, room.reportReason = reason
3. Log to a reports collection (userId, roomId, reason, createdAt)
4. Return 200
```

The Supabase channel goes dead automatically once the client sees `expired`. No additional socket teardown needed.

---

## The Agentic Guardian

The pitch lists the Guardian as a core mechanic. It lives as a Supabase Edge Function, not a Next.js route.

**What it does:** Monitors live rooms. Injects a nudge if chat goes cold. Detects emotional distress signals.

**Trigger:** Supabase scheduled function, runs every 5 minutes.

**Logic (pseudocode):**
```
for each active room:
  fetch last 10 messages from Supabase messages table
  if lastMessageTime > 15 minutes ago:
    call Gemini: "given these two diary entries and this conversation,
                  generate a gentle re-engagement question"
    insert message into Supabase channel as sender: "guardian"

  call Gemini: "does this conversation show signs of acute distress?
                reply YES or NO and a severity 1-3"
  if YES and severity >= 2:
    insert Supabase message: gentle check-in + crisis resource link
    flag room in MongoDB: room.guardianAlert = true
```

The client renders Guardian messages with a distinct visual treatment (soft, italic, no user avatar). Users see it as ambient empathy, not a bot interruption.

**Why a Supabase function, not a Next.js route:** It needs to run on a schedule and read Supabase messages directly. Keeping it co-located with Supabase avoids cross-service latency and keeps the Next.js routes stateless.

---

## Data Model

Three collections in MongoDB. The messages table is in Supabase, not MongoDB.

**entries**
```ts
{
  _id: ObjectId,
  userId: string,          // auth0 sub
  text: string,
  embedding: number[],     // 768-dim float array
  matched: boolean,
  isSeeded: boolean,
  createdAt: Date
}
```
Index: `embedding` as Atlas Vector Search index (cosine, 768 dims). Also index `matched` + `isSeeded` for the matching query.

**rooms**
```ts
{
  _id: ObjectId,
  userAId: string,
  userBId: string,
  entryAId: ObjectId,
  entryBId: ObjectId,
  icebreaker: string,
  voiceUrl: string,
  supabaseChannel: string,
  createdAt: Date,
  expired: boolean,
  expiresAt: Date,         // createdAt + 24h, for easy querying
  guardianAlert: boolean,
  reportedAt?: Date,
  reportReason?: string
}
```

**reports** *(append-only, for moderation)*
```ts
{
  _id: ObjectId,
  userId: string,
  roomId: ObjectId,
  reason: string,
  createdAt: Date
}
```

**Supabase messages table** *(managed by Supabase Realtime)*
```ts
{
  id: uuid,
  room_id: string,
  sender_id: string,       // auth0 sub, or "guardian"
  content: string,
  created_at: timestamp
}
```

---

## The Seed Pool

Twenty pre-written entries, pre-embedded, in MongoDB with `isSeeded: true`.

When a real user submits and no live unmatched entry exists within 30 seconds, the matching query drops the `isSeeded: false` filter. A seeded entry matches. The user gets a room with a real-feeling conversation partner (the Guardian fills in, or it's just the icebreaker). The demo never dead-ends.

Write and embed the seed entries before building the matching logic. Commit them as a seed script (`scripts/seed.ts`).

---

## Expiry

Supabase Edge Function, runs every minute via `pg_cron`:

```sql
select cron.schedule(
  'expire-rooms',
  '* * * * *',
  $$
    update rooms set expired = true
    where expires_at < now() and expired = false;
  $$
);
```

This assumes you mirror the `expiresAt` field into Supabase if you want to run the cron there, or you run it as a Supabase Edge Function hitting MongoDB:

```ts
// supabase/functions/expire-rooms/index.ts
const rooms = await mongo.db('parallel').collection('rooms');
await rooms.updateMany(
  { expiresAt: { $lt: new Date() }, expired: false },
  { $set: { expired: true } }
);
```

The client polls `GET /api/room/:id` every 10 seconds. When `expired: true` lands, it renders the Sunset screen. No websocket teardown. No push needed.

---

## Supabase vs MongoDB — Exact Boundary

| What | Where | Why |
|------|-------|-----|
| User entries + embeddings | MongoDB | Needs vector search |
| Room metadata | MongoDB | Source of truth, needs complex queries |
| Live messages | Supabase | Realtime socket, ephemeral |
| Expiry cron | Supabase or MongoDB | Either works, pick one |
| Reports | MongoDB | Persistent moderation record |
| Auth sessions | Auth0 | Managed entirely |

---

## Environment Variables

```bash
# Auth0
AUTH0_SECRET=                    # 32-char random string: openssl rand -hex 16
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# MongoDB
MONGODB_URI=mongodb+srv://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # safe to expose — RLS handles access
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never expose to client

# Gemini
GEMINI_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=             # pick one warm, calm voice

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Rule: anything prefixed `NEXT_PUBLIC_` is safe to expose. Everything else is server-only and must never appear in client bundles.

---

## Security Notes

- **Rate limiting on `/api/entry`:** One submission per user per hour. Check `entries` collection for `userId + createdAt > now - 1h` before processing. Returns `429` if exceeded.
- **Input sanitization:** Strip HTML from entry text before embedding or storing. `text.replace(/<[^>]*>/g, '')`.
- **Room access guard:** Every `GET /api/room/:id` must verify the requesting `userId` is `userAId` or `userBId`. A `403` is not optional.
- **Supabase RLS:** Enable Row Level Security on the messages table. Policy: users can only read/write rows where `room_id` matches a room they belong to. Your MongoDB rooms collection is the source of truth for membership.
- **Never log entry text.** Embeddings are fine to log. Raw diary content is not.

---

## Build Order

| Hour | Task |
|------|------|
| 0–1 | Auth0 setup + `[...auth0].ts` handler + middleware wrapper |
| 1–2 | MongoDB Atlas cluster + vector index in UI |
| 2–3 | Seed pool — 20 entries embedded + loaded via `scripts/seed.ts` |
| 3–5 | `POST /api/entry` — embed + store + match logic |
| 5–6 | `POST /api/room` — icebreaker + ElevenLabs voice |
| 6–7 | Supabase Realtime channel wired to frontend |
| 7–8 | `GET /api/room/:id` + expiry function |
| 8–9 | Guardian agent (Supabase Edge Function) |
| 9–10 | `POST /api/report` + RLS policies on Supabase |

Ten hours. Backend complete. Fourteen hours for frontend and polish.
