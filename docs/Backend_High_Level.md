## Backend — High Level

---

### What the backend actually needs to do

Five jobs. That's it.

1. **Auth** — verify users, manage sessions
2. **Ingest** — receive an entry, embed it, store it
3. **Match** — find the closest unmatched entry, pair the two users
4. **Chat** — real-time message passing between two users
5. **Expire** — kill the chat after 24 hours

---

### The Stack

| Job | Tool |
|-----|------|
| Auth | Auth0 |
| API | Next.js API routes (serverless, already in your frontend repo) |
| Embedding | Gemini `gemini-embedding-001` |
| Database + Vector Search | MongoDB Atlas |
| Realtime chat | Supabase Realtime |
| Voice | ElevenLabs |
| LLM (icebreaker) | Gemini via Lava |
| Expiry | Supabase scheduled function or a simple cron |

No separate backend server. Everything runs serverless through Next.js API routes. Fewer moving parts, faster to ship.

---

### The Three Critical Paths

**Path 1 — Entry submission**
```
POST /api/entry
→ embed with Gemini
→ store in MongoDB
→ attempt match
→ if match found: create chat room, generate icebreaker, trigger ElevenLabs
→ if no match: return "waiting" state, pull from seed pool after 30s
```

**Path 2 — Chat**
```
All messaging bypasses your API entirely
→ client talks directly to Supabase Realtime
→ your API only creates/destroys the room
```

**Path 3 — Expiry**
```
Room has a created_at timestamp
→ cron checks every minute for rooms older than 24hrs
→ marks room as expired
→ client polls room status and renders Sunset screen
```

---

### The Data Model (just the shapes, not the schema)

Three collections in MongoDB:

- **entries** — the text, the embedding vector, the user ID, matched/unmatched flag
- **rooms** — two user IDs, icebreaker text, created_at, expired flag
- **messages** — handled by Supabase, not MongoDB

---

### The Seed Pool

Twenty pre-written entries, pre-embedded, sitting in MongoDB with a `isSeeded: true` flag. When a real user submits and no live match exists within 30 seconds, the matching query includes seeded entries. The user never knows. This is what makes your demo bulletproof.

Write and embed the seed entries **in hour 3**, before you build the matching logic.

---

### What Supabase Does vs What MongoDB Does

This trips teams up. Keep it clean:

- **MongoDB** — everything persistent. Entries, embeddings, room metadata, user records.
- **Supabase** — only the live message stream. Think of it as a pipe, not a database.

---

That's the whole backend. Four API routes, two external services talking to each other, one cron job. 


## Backend — Revised

---

### The Principle

You are not building infrastructure. You are gluing providers together. Every job has an owner. You write the glue.

---

### Provider Assignments

| Job | Provider | You build |
|-----|----------|-----------|
| Auth | Auth0 | Nothing. Drop in their SDK. |
| Database | MongoDB Atlas | Nothing. Hosted, managed. |
| Vector search | MongoDB Atlas | One index in the UI, done. |
| Realtime chat | Supabase Realtime | Nothing. They manage the socket. |
| Embeddings | Gemini | One API call. |
| Icebreaker LLM | Gemini via Lava | One API call. |
| Voice | ElevenLabs | One API call. |
| Expiry | Supabase scheduled functions | ~10 lines. |

---

### What You Actually Write

**Four API routes. That's your entire backend.**

```
POST /api/entry      ← receive entry, embed, store, attempt match
POST /api/room       ← create room, generate icebreaker, trigger voice
GET  /api/room/:id   ← poll room status (waiting / active / expired)
POST /api/report     ← safety. flag a room, kill it.
```

Everything else is a provider call inside those four routes.

---

### Chat is 100% Supabase

You do not touch sockets. Ever. The client connects directly to Supabase Realtime. Your API only creates the room record — Supabase handles everything from that point.

```
Your API → creates room in MongoDB + Supabase channel
Client A → subscribes to Supabase channel
Client B → subscribes to Supabase channel
Messages → flow directly between clients via Supabase
Your API → never sees a single message
```

---

### Expiry is 100% Supabase

Supabase has built-in scheduled functions. You write one function, ~10 lines, that runs every minute and marks rooms older than 24 hours as expired. The client polls `GET /api/room/:id` and renders the Sunset screen when it sees the expired flag. No custom cron infrastructure.

---

### The Revised Data Model

Two collections in MongoDB. That's it.

**entries**
```
userId, text, embedding[], matched, isSeeded, createdAt
```

**rooms**
```
userAId, userBId, icebreaker, voiceUrl, createdAt, expired
```

Messages never touch MongoDB. They live and die in Supabase.

---

### What Supabase Knows vs What MongoDB Knows

- **MongoDB** — everything that needs to persist. Entries, embeddings, room metadata.
- **Supabase** — the live pipe. Messages and the expiry cron. Nothing else.

---

### Build Order for the Backend

| Hour | Task |
|------|------|
| 0–1 | Auth0 setup. Done. Never touch again. |
| 1–2 | MongoDB Atlas cluster + vector index created in UI |
| 2–3 | Seed pool — 20 pre-embedded entries loaded into MongoDB |
| 3–5 | `POST /api/entry` — embed + store + match logic |
| 5–6 | `POST /api/room` — icebreaker + ElevenLabs voice |
| 6–7 | Supabase Realtime channel wired to frontend |
| 7–8 | `GET /api/room/:id` + expiry function in Supabase |

Eight hours. Backend done. Sixteen hours left for frontend and polish.
