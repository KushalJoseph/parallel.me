## P0 — Ship or Die

These are the features without which you have no demo. Not nice-to-have. Not impressive. Just **the app doesn't exist without these.**

---

### 1. Auth (Auth0)
Sign up, log in, session management. Nothing works without this. 30 minutes. Do it first.

---

### 2. The Write Screen
A text input. A submit button. A word floor (~50 words) with a soft indicator. That's it. No formatting. No tags. No mood selector. Just text.

---

### 3. Embedding + Matching (Gemini + MongoDB Atlas)
Take the submitted entry, generate an embedding via Gemini, store in MongoDB Atlas, query for nearest neighbor. This is the entire product mechanic. If this doesn't work, nothing works.

**Critical sub-requirement:** A seeded match pool of ~20 pre-written entries with pre-computed embeddings. If no live user is writing at the same time as the demo, you still get a match. This is non-negotiable for a hackathon demo. Do this early.

---

### 4. The Waiting Screen
Show something alive while matching runs. Even a simple animated state. The match should resolve in under 5 seconds with the seed pool.

---

### 5. AI Icebreaker Generation (Gemini via Lava)
Once two entries are matched, send both to Gemini and generate one opening question. Display it to both users before the chat opens. This is the magic moment — it must work reliably.

---

### 6. Real-time Chat (Supabase Realtime)
Two users in a room. Messages send and receive. That's the whole requirement. No media. No reactions. Just text in and text out.

---

### 7. The 24-Hour Countdown
A timer visible in the chat screen. Starts at match. When it hits zero, chat becomes read-only. Five minutes later, room is gone. This enforces the entire emotional premise of the product.

---

### 8. The Sunset Screen
When the timer expires, show a deliberate closing screen. Don't just kick users to a 404. This moment needs to feel intentional — it's part of the product thesis.

---

### 9. ElevenLabs Voice Icebreaker
The one "wow" moment in the demo. The generated icebreaker is read aloud on the Match Reveal screen. Judges will remember this. It's also a free MLH prize entry. 2 hours max.

---

### 10. Anonymous Identity
Users have no visible name, photo, or profile anywhere in the product. Their identity is an abstract placeholder — a shape, a color, a symbol. This must be true from the moment of signup.

---

## What Is Explicitly NOT P0

Everything else we've discussed is P1 or later.

- Progressive identity disclosure — cut
- Polymarket integration — P1
- Hex "The Pulse" dashboard — P1
- Distress detection — P1
- AI nudges mid-conversation — P1
- Snap anything — cut
- Solana — cut

---

## The Honest Build Order

| Hour | What |
|------|------|
| 0–1 | Auth0 setup + basic routing |
| 1–3 | Write screen + MongoDB Atlas schema |
| 3–6 | Embedding pipeline + seed pool |
| 6–8 | Matching logic + waiting screen |
| 8–10 | Supabase Realtime chat room |
| 10–11 | Icebreaker generation (Gemini/Lava) |
| 11–12 | ElevenLabs voice on match reveal |
| 12–16 | Countdown timer + sunset screen |
| 16–20 | Polish, edge cases, demo flow |
| 20–24 | P1 features if time, otherwise sleep |

---

Ship these 10 things and you have a working, demoable, prize-eligible product. Everything else is a bonus.
