# Frontend ↔ Backend Integration Guide

This document describes how the Next.js/React frontend connects to the FastAPI backend. The backend is the source of truth — every frontend decision below is driven by what the backend already produces.

---

## Authentication (Auth0)

The entire frontend auth layer is handled by **Auth0**. The backend validates every `/api/*` call using the Auth0 `access_token` as a Bearer JWT.

### Setup

Install the Auth0 Next.js SDK:

```bash
npm install @auth0/nextjs-auth0
```

Configure environment variables in `.env.local`:

```env
AUTH0_SECRET=<same as backend AUTH0_SECRET>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<AUTH0_DOMAIN>
AUTH0_CLIENT_ID=<AUTH0_CLIENT_ID>
AUTH0_CLIENT_SECRET=<AUTH0_CLIENT_SECRET>
AUTH0_AUDIENCE=<AUTH0_API_AUDIENCE>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Wrap `app/layout.tsx` with the Auth0 `UserProvider`:

```tsx
import { UserProvider } from "@auth0/nextjs-auth0/client";

export default function RootLayout({ children }) {
  return <UserProvider>{children}</UserProvider>;
}
```

Add the Auth0 catch-all API route at `app/api/auth/[auth0]/route.ts`:

```ts
import { handleAuth } from "@auth0/nextjs-auth0";
export const GET = handleAuth();
```

This automatically creates `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`.

The `/auth` page simply redirects to `/api/auth/login`. After login, Auth0 redirects back and the SDK manages the session cookie automatically.

### Making Authenticated API Calls

Retrieve the `access_token` server-side and attach it to all backend calls:

```ts
import { getAccessToken } from "@auth0/nextjs-auth0";

const { accessToken } = await getAccessToken();

const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/entry`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ text }),
});
```

> For client components, use `useUser()` to check auth state for redirects. Use server actions or route handlers to make authenticated backend calls so the token stays server-side.

---

## Route: `/write` → `POST /api/entry`

**Screen trigger:** User finishes writing and taps "Find my parallel →"

**Call:**

```ts
POST /api/entry
Body: { "text": "user's diary entry" }
Authorization: Bearer <accessToken>
```

**Important:** `POST /api/entry` is **synchronous**. The backend does all the Gemini embedding and MongoDB vector search in one blocking HTTP request. It will not return until it has a definitive answer — either a live match was found or not. The round-trip typically takes **1–3 seconds**.

**Loading State:**

Immediately on button tap, switch into your loading UI **before** the fetch call resolves. The backend won't respond instantly — use a React state flag:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  setIsSubmitting(true); // Show loading animation NOW

  try {
    const res = await fetch(`${API_URL}/api/entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json(); // ← blocks here while backend works (1–3s)

    if (data.status === "matched") {
      router.push(`/match?roomId=${data.roomId}`);
    } else {
      // data.status === 'waiting'
      router.push(`/waiting?entryId=${data.entryId}`);
    }
  } catch (err) {
    setIsSubmitting(false); // Re-enable button on network error
    showToast("Something went wrong. Please try again.");
  }
};
```

**What the loading screen should show:** The animated "two shapes approaching each other" from the `/waiting` design. Transition into this loader immediately on button tap — don't wait for the API to respond. When the API responds, either settle the animation into a match reveal or hold the orbit loop while polling begins.

**Handling the response:**
| `status` | What to do |
|---|---|
| `"matched"` | Navigate to `/match?roomId=...` — skip `/waiting` entirely |
| `"waiting"` | Navigate to `/waiting?entryId=...` — begin polling |
| Network error | Show error toast, re-enable submit button |
| `401` | Token expired — redirect to `/api/auth/login` |
| `500` | Show generic error, do not retry automatically |

---

## Route: `/waiting` — Polling for a Match

The `/waiting` screen runs an animated "searching" loop. While the animation plays, poll the backend every few seconds to check if the entry has been matched.

**Strategy:** The backend does not push notifications. The frontend polls.

```ts
// entryId comes from the query param (e.g., set via router when you receive "waiting")
const poll = setInterval(async () => {
  const res = await fetch(`${API_URL}/api/entry/${entryId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (data.status === "matched") {
    clearInterval(poll);
    router.push(`/match?roomId=${data.roomId}`);
  }
}, 5000); // poll every 5 seconds
```

Clean up the interval on component unmount (`useEffect` cleanup).

---

## Route: `/match` → `GET /api/room/{roomId}`

Once we have a `roomId`, fetch the room details to display the icebreaker and Supabase channel.

```ts
const res = await fetch(`${API_URL}/api/room/${roomId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const room = await res.json();
// room.icebreaker — the AI-generated opening question
// room.supabaseChannel — e.g. "room-<uuid>"
// room.expiresAt — ISO date string
```

Display the icebreaker in large Playfair Display italic. Store `supabaseChannel` and `expiresAt` in state — you'll need them for the chat screen.

---

## Route: `/chat/[roomId]` — Supabase Realtime Chat

> Real-time messaging **never touches the FastAPI backend**. All messages go directly through Supabase Realtime Broadcast.

### Setup

```bash
npm install @supabase/supabase-js
```

```ts
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

### Subscribing to a Channel

```ts
const channel = supabase.channel(supabaseChannel); // e.g. "room-<uuid>"

channel
  .on("broadcast", { event: "message" }, ({ payload }) => {
    setMessages((prev) => [...prev, payload]);
  })
  .subscribe();

// Cleanup on unmount
return () => {
  supabase.removeChannel(channel);
};
```

### Sending a Message

```ts
await channel.send({
  type: "broadcast",
  event: "message",
  payload: {
    senderId: userId, // Auth0 sub — available from useUser()
    text: inputValue,
    timestamp: new Date().toISOString(),
  },
});
```

> Messages are not stored in Supabase or MongoDB. They are ephemeral, broadcast-only. If a user refreshes, message history is gone — this is intentional to preserve the anonymous, impermanent nature of the app.

### Auth on Supabase

Use the **public anon key** only. The `supabaseChannel` UUID is unguessable (a random UUID4 generated per-room by the backend). Only the two matched users receive this channel name from `GET /api/room/{roomId}` (which is itself Auth0-protected). This is sufficient security for an anonymous ephemeral chat.

### Room Expiry — Sunset Screen

Poll `GET /api/room/{roomId}` every 60 seconds during the chat. When it returns `{"status": "expired"}`, trigger the sunset animation and navigate to `/sunset`.

```ts
const expiryPoll = setInterval(async () => {
  const res = await fetch(`${API_URL}/api/room/${roomId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { status } = await res.json();
  if (status === "expired") {
    clearInterval(expiryPoll);
    router.push("/sunset");
  }
}, 60000);
```

---

## Full Flow Summary

```
/auth        → Auth0 login    → sets session cookie
/write       → POST /api/entry → { status: "matched", roomId } or { status: "waiting", entryId }
/waiting     → poll POST /api/entry every 5s until matched
/match       → GET /api/room/{roomId} → icebreaker + supabaseChannel + expiresAt
/chat/[id]   → supabase.channel(supabaseChannel).on('broadcast', ...) → live messages
             → poll GET /api/room/{roomId} every 60s → detect expiry
/sunset      → show when room.status === "expired"
```

---

## Environment Variables (Frontend)

```env
# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<AUTH0_DOMAIN>
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=<AUTH0_API_AUDIENCE>

# Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
