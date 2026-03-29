# Parallel — Frontend

A Next.js 16 (App Router) web app for anonymous, ephemeral, AI-matched emotional conversations. Two strangers who feel exactly the same thing are connected for 24 hours. When the timer runs out, the conversation disappears forever.

---

## Tech Stack

| Concern | Library |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Auth | Auth0 (`@auth0/nextjs-auth0` v4) |
| Realtime chat | Supabase Realtime (broadcast channels) |
| Icons | Lucide React |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # "/" — Landing page
│   ├── layout.tsx            # Root layout (fonts, global background, TransitionLayout)
│   ├── globals.css           # Global styles
│   ├── actions.ts            # Server Actions (API calls to backend, auth token handling)
│   ├── how-it-works/
│   │   └── page.tsx          # "/how-it-works" — Scrollable 3-step explainer
│   ├── auth/
│   │   └── page.tsx          # "/auth" — Auth0 login entry point
│   ├── write/
│   │   └── page.tsx          # "/write" — Journal entry submission
│   ├── waiting/
│   │   └── page.tsx          # "/waiting" — Polling screen while awaiting a match
│   ├── match/
│   │   └── page.tsx          # "/match" — Match reveal + icebreaker reveal
│   ├── chat/
│   │   └── [roomId]/
│   │       └── page.tsx      # "/chat/[roomId]" — Live anonymous chat room
│   └── sunset/
│       └── page.tsx          # "/sunset" — End-of-conversation screen
├── components/
│   ├── TransitionLayout.tsx  # Animated page wrapper (slide vs lift transitions)
│   └── SettingsDrawer.tsx    # Right-side slide-out settings panel (chat page)
├── lib/
│   ├── auth0.ts              # Auth0 client singleton
│   └── supabase.ts           # Supabase client singleton
└── proxy.ts                  # Auth0 middleware (runs on every request)
```

---

## Page Flow

```
/  →  /how-it-works  →  /auth  →  /write  →  /waiting  →  /match  →  /chat/[roomId]  →  /sunset  →  /write
                                       ↘_________________________↗
                                          (if matched immediately)
```

### 1. `/` — Landing

`app/page.tsx`

The entry point. Displays the **"Parallel"** wordmark, the tagline animated word-by-word, a "Begin" CTA button, and a blurred preview of a chat interface rising up from the bottom of the screen (purely decorative, non-interactive).

**Navigates to:** `/how-it-works`

---

### 2. `/how-it-works` — Explainer

`app/how-it-works/page.tsx`

A vertically scrollable, **snap-paged** sequence of three full-screen step cards:

| Step | Title | Description |
|---|---|---|
| 01 | Write. | Pour it out. No audience. No filter. |
| 02 | Match. | AI finds the one stranger feeling exactly what you feel. |
| 03 | Talk. | 24 hours. Anonymous. Real. Then it's gone forever. |

Each card fades and scales in/out as it enters/leaves the viewport using Framer Motion's `useScroll` + `useTransform`. A final section at the bottom holds the "Create your account →" CTA.

**Navigates to:** `/auth`

---

### 3. `/auth` — Authentication

`app/auth/page.tsx`

Presents three login buttons:
- **Continue with Google** — calls `/auth/login?returnTo=/write`
- **Continue with Apple** — calls `/auth/login?returnTo=/write`
- **Or continue with email** — calls `/api/auth/login` (Auth0 universal login)

All three routes are handled by the Auth0 middleware. After a successful login, Auth0 redirects the user to `/write`.

**Auth architecture:**
- `src/lib/auth0.ts` — instantiates a single `Auth0Client` with the configured `AUTH0_AUDIENCE` and `openid profile email` scopes.
- `src/proxy.ts` — exports an Auth0 middleware that runs on every request (excluding Next.js static assets) to manage session cookies and protect routes.

**Navigates to:** `/write` (via Auth0 `returnTo`)

---

### 4. `/write` — Journal Entry

`app/write/page.tsx`

The core emotional input screen. A full-page `<textarea>` with the placeholder *"What's sitting with you right now?"* autofocuses on mount. The current date (e.g. "Saturday, March 28") is shown in the header.

**Submission rules:**
- A progress bar fills as the user types, tracking word count toward the **50-word minimum**.
- The submit button ("Find my parallel →") only appears once the 50-word threshold is reached.
- On submit, `submitEntry(text)` Server Action is called, which POSTs to `POST /api/entry` on the backend with the user's Auth0 Bearer token.

**Backend response handling:**

| `data.status` | Navigation |
|---|---|
| `"matched"` | Immediately navigates to `/match?roomId={data.roomId}` |
| anything else | Navigates to `/waiting?entryId={data.entryId}` |

---

### 5. `/waiting` — Match Pending

`app/waiting/page.tsx`

Shown when no immediate match was found. Displays an animated pair of circles orbiting each other while polling the backend.

**Polling logic:**
- Calls `pollEntry(entryId)` (GET `/api/entry/:id`) every **5 seconds**.
- Also calls it immediately on mount.
- Cycles through three status strings every 2.5 seconds: `"Reading your wavelength..."`, `"Searching for your parallel..."`, `"Someone is out there..."`

**On match:**
1. Sets `isMatched = true`, triggering a visual flash animation (the "ghost" circle snaps to solid peach, a bloom expands and fades).
2. Waits **1.2 seconds** for the animation to finish.
3. Navigates to `/match?roomId={data.roomId}`.

A `mounted` ref guards all state updates so no setState calls fire after unmount.

**Navigates to:** `/match?roomId=...`

---

### 6. `/match` — Match Reveal

`app/match/page.tsx`

A cinematic reveal screen that confirms the match and teases the conversation with an AI-generated icebreaker.

**On mount:**
- Calls `getRoom(roomId)` to fetch room data from the backend.
- If the room is `active`, reads the `icebreaker` string (a sentence generated by the backend AI from both users' entries).

**Reveal sequence (timed with Framer Motion):**
1. Two overlapping circles (representing the two users) animate in.
2. `"Your Parallel has arrived"` label fades in (delay: 0.8s).
3. Each word of the icebreaker sentence reveals one-by-one in an italic serif typewriter effect (delay: 1.5s + 0.25s per word).
4. A `23:59:59` countdown timer fades in (delay: 3.5s).
5. "Enter the conversation →" CTA appears after all icebreaker words have finished animating.

**Navigates to:** `/chat/{roomId}`

---

### 7. `/chat/[roomId]` — Live Chat

`app/chat/[roomId]/page.tsx`

The main chat interface. This is the most complex page in the app.

#### Layout

- **Sticky header** — two overlapping circles (visual identity), a live countdown timer (turns red with a glow when under 1 hour), a dev "Expire" shortcut button, and a settings gear icon.
- **Scrollable message thread** — flex column of animated message bubbles.
- **Sticky input area** — auto-resizing textarea (max 140px tall), send button, and progressive identity chips.

#### Message Bubbles

Messages are rendered with `AnimatePresence` + `motion.div` spring animations. Alignment is determined by `msg.senderId === myUserId`:

| Condition | Alignment | Style |
|---|---|---|
| `msg.isSystem === true` | Center | Rounded pill, monospace font, muted |
| `msg.senderId === myUserId` | Right | Warm off-white (`#F0EBE3`), dark text |
| Other sender | Left | Dark surface, light text |

#### AI Nudge

If there is at least one message and the user has not typed or received a new message for **8 consecutive seconds**, a draggable card floats up from the bottom showing an AI-generated conversation prompt (currently hardcoded as a prototype). Dragging it down by 30px or flicking it dismisses it permanently for the session.

#### Progressive Identity Chips

After the first message is exchanged (`messages.length > 1`), two chips appear above the input bar:
- **Share first name** → broadcasts a system message: "They shared their name — it's Jamie."
- **Share city** → broadcasts a system message: "They shared their city — it's Brooklyn."

The local sender sees a mirrored version: "You shared your name — it's Jamie." Each chip disappears permanently once tapped.

#### Room Expiry Polling

Every **60 seconds**, `getRoom(roomId)` is called. If `status === "expired"`, the interval is cleared and the user is pushed to `/sunset`.

**Navigates to:** `/sunset`

---

### 8. `/sunset` — Conversation End

`app/sunset/page.tsx`

A full-screen takeover (fixed, `z-50`, nearly-black `#070605` background) that plays when a room expires.

**Staged reveal sequence:**
1. **Immediate** — page blurs in from `blur(40px)`, two overlapping circles begin drifting apart over 4 seconds.
2. **3.5s** — `"This parallel has closed."` fades up.
3. **5.2s** — Post-conversation poll appears: "Did you feel understood?" with **yes** / **no** buttons (UI only in current build), and a "Write again →" link.

**Navigates to:** `/write`

---

## Supabase Realtime Chat — Deep Dive

Supabase is used **exclusively for real-time message delivery**. It is not used as a database by the frontend. All persistent data (rooms, entries, match status) lives in the backend API.

### Client Setup

`src/lib/supabase.ts` exports a single `createClient` instance shared across the app:

```ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Channel Lifecycle

Inside the `/chat/[roomId]` page, a `useEffect` sets up the channel when the component mounts:

```
useEffect (runs on mount)
│
├─ Promise.all([getUserId(), getRoom(roomId)])
│   │
│   └─ On resolve:
│       ├─ setMyUserId(uid)             ← identifies which messages are "mine"
│       ├─ getRoom() returns { supabaseChannel, status, ... }
│       │
│       ├─ supabase.channel(supabaseChannel)
│       │   .on("broadcast", { event: "message" }, handler)
│       │   .subscribe()
│       │
│       └─ starts 60s expiry poll interval
│
└─ Cleanup (on unmount or roomId change):
    ├─ cancelled = true          ← prevents orphaned async subscriptions
    ├─ supabase.removeChannel()
    └─ clearInterval(expirePoll)
```

The `supabaseChannel` string (e.g. `"room:abc-123"`) comes from the backend API. Both users in a matched pair are given the same channel name, so they naturally end up in the same Supabase broadcast group.

### Sending a Message

```
handleSend()
│
├─ Build payload: { id, text, senderId }
├─ channel.send({ type: "broadcast", event: "message", payload })
│   └─ Supabase delivers this to ALL OTHER subscribers (no self-echo by default)
│
└─ setMessages(prev => [...prev, payload])
    └─ Sender sees their own message immediately via local state (not via broadcast)
```

### Receiving a Message

```
broadcast handler fires (on receiver's client)
│
└─ setMessages(prev => [...prev, payload])
    └─ payload contains { id, text, senderId } from the sender
```

Because Supabase broadcast does **not** echo messages back to the sender by default, and the sender adds the message to local state manually, each user sees every message exactly once.

### The Cancelled-Flag Guard

The `useEffect` that creates the channel is async (it awaits `Promise.all`). React (especially with Strict Mode) may run the cleanup function before the Promise resolves. Without a guard, this creates orphaned subscriptions — the cleanup fires when `activeChannel` is still `null`, then the Promise resolves and creates a channel that is never removed. If this happens twice, the receiver ends up with two active subscriptions and sees every incoming message duplicated.

The fix is a `cancelled` boolean declared in the effect's scope:

```ts
let cancelled = false;

Promise.all([...]).then(([uid, roomData]) => {
  if (cancelled) return;  // bail out if cleanup already ran
  // ... create channel
  activeChannel = ch;
});

return () => {
  cancelled = true;       // mark as cleaned up before anything else
  if (activeChannel) supabase.removeChannel(activeChannel);
};
```

---

## Server Actions

`src/app/actions.ts` — all functions are marked `"use server"` and run on the server. They attach the user's Auth0 access token to every request to the backend API.

| Function | Method | Endpoint | Purpose |
|---|---|---|---|
| `getUserId()` | — | Auth0 session | Returns the user's Auth0 `sub` (unique ID) |
| `getAuthToken()` | — | Auth0 session | Returns a raw Bearer access token (internal) |
| `submitEntry(text)` | `POST` | `/api/entry` | Submits the journal entry; returns `{ status, roomId?, entryId? }` |
| `pollEntry(entryId)` | `GET` | `/api/entry/:id` | Checks match status; returns `{ status, roomId? }` |
| `getRoom(roomId)` | `GET` | `/api/room/:id` | Fetches room data: `{ status, supabaseChannel, icebreaker }` |

All calls include `Authorization: Bearer <token>` via `getAuthToken()`.

---

## Shared Components

### `TransitionLayout`

`src/components/TransitionLayout.tsx`

Wraps every page inside `layout.tsx`. Uses `AnimatePresence` + `motion.div` keyed by the current pathname to animate between routes.

| Route | Enter/Exit animation |
|---|---|
| `/match`, `/sunset` | Fade + vertical lift (`y: 20 → 0`) |
| All others | Fade + horizontal slide (`x: 20 → 0`) |

### `SettingsDrawer`

`src/components/SettingsDrawer.tsx`

A right-side slide-out panel, accessible from the chat page header. Spring-animated in/out (`x: "100%" → 0`). Contains:

- **Notifications toggle** — local state only in current build.
- **Report this conversation** — UI only in current build.
- **Delete my account** — UI only in current build.
- **Footer** — shows a static placeholder conversation count.

---

## Environment Variables

Create a `.env.local` file at the root of `/frontend`:

```
# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=

# Backend API
NEXT_PUBLIC_API_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Running Locally

```sh
cd frontend
npm install
npm run dev
```

The app starts at `http://localhost:3000`.

To run with Auth0 auth working locally, `AUTH0_BASE_URL` must be set to `http://localhost:3000` and your Auth0 application must have `http://localhost:3000/auth/callback` in its allowed callback URLs.