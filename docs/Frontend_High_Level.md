## Parallel — Frontend Design & Flow Doc

---

### Design Language

One decision drives everything: **this app exists at night.**

Not literally — but emotionally. The person opening Parallel is in a quiet, private, introspective moment. The UI needs to feel like that moment. Calm. Intimate. A little cinematic.

**The aesthetic:** Dark background. Warm, not cold. Think candlelight, not fluorescent. Typography does the heavy lifting — no loud graphics, no illustrated characters. The UI gets out of the way and lets the words be the product.

**The feeling:** Like opening a leather journal in a dimly lit room. Or the quiet moment before a stranger on a train says something unexpectedly real.

---

### Design System

**Colors**
```
Background:     #0A0908   ← near black, warm undertone
Surface:        #141210   ← cards, input areas  
Border:         #2A2520   ← subtle dividers
Text primary:   #F0EBE3   ← warm white
Text secondary: #8A7F74   ← muted, timestamps, labels
Accent:         #C8442A   ← the one red. used sparingly.
Accent warm:    #E8A87C   ← peach. match reveal moment only.
```

**Typography**
```
Display:   Playfair Display — serif, italic for emotional moments
Body:      DM Sans — clean, friendly, readable at small sizes
Mono:      DM Mono — timers, labels, system text
```

**Motion Principles**
- Everything eases out, never linear
- Page transitions: 400ms, horizontal slide or vertical lift
- Emotional moments (match reveal, sunset): slower, 600–800ms
- Never two things animating simultaneously unless intentional
- Framer Motion `spring` for anything tactile. `tween` for everything else.

**Spacing**
Mobile-first. 24px horizontal padding throughout. Generous vertical breathing room. Nothing feels cramped.

---

### Navigation & Routing

```
/                   ← Landing
/how-it-works       ← Explainer
/auth               ← Login / Signup
/write              ← Home (the journal screen)
/waiting            ← Matching in progress
/match              ← Match reveal
/chat/[roomId]      ← The conversation
/sunset             ← Chat expired
/settings           ← Utility drawer
```

Transitions between routes use Framer `AnimatePresence`. Each screen slides in from the right except for emotional beats (waiting → match, chat → sunset) which use a vertical lift to signal a gear change.

---

### Screen by Screen

---

#### Screen 1 — Landing `/`

**Purpose:** Make someone feel the product in 5 seconds. No signup wall yet.

**Layout:**
- Full screen, dark background
- Vertically centered content
- Top: wordmark `Parallel` in Playfair Display, italic
- Middle: the line — *"Find the one person who feels exactly what you feel, right now."* Large, warm white, generous line height
- Below: a blurred, unreadable glimpse of what a matched chat looks like — two abstract anonymous shapes, partial message bubbles, a countdown timer. Tantalising. Unreadable. Just enough to make you curious.
- Bottom: one CTA button — `Begin` — in the accent red

**Animation on load:**
- Wordmark fades in first (300ms)
- Tagline words stagger in one by one (500ms total)
- The blurred chat glimpse rises from below (600ms, spring)
- CTA button appears last (400ms)

**What it does not have:** Nav bar. Pricing. Features list. Social proof. None of it.

---

#### Screen 2 — How It Works `/how-it-works`

**Purpose:** Three steps. Build trust before asking for vulnerability.

**Layout:**
- Full screen scroll, or swipeable cards — decision based on time available
- Three cards, vertically stacked, each with:
  - A large numeral (`01`, `02`, `03`) in muted red
  - A single verb as headline (`Write.` / `Match.` / `Talk.`)
  - Two sentences max of explanation
  - A minimal abstract illustration — not a screenshot, just a shape or icon

**The three steps:**
```
01 — Write.
     Pour it out. No audience. No filter.
     Just you and a blank page.

02 — Match.
     Our AI finds the one stranger 
     feeling exactly what you feel.

03 — Talk.
     24 hours. Anonymous. Real.
     Then it's gone forever.
```

**Animation:** Each card animates in on scroll/swipe. Previous card fades and scales down slightly as next appears.

**Bottom CTA:** `Create your account →`

---

#### Screen 3 — Auth `/auth`

**Purpose:** Get out of the way as fast as possible.

**Layout:**
- Wordmark at top
- One line: *"No name. No profile. Just you."*
- Social auth buttons only: `Continue with Google` / `Continue with Apple`
- Below in small muted text: `Or continue with email`

**What's not here:** No username field. No display name. No avatar. The anonymity is communicated by the absence of those fields, not by explaining it.

**Animation:** Simple fade in. Nothing clever. This screen should feel fast.

---

#### Screen 4 — Write `/write` ⭐ *The heart*

**Purpose:** A distraction-free space to write something honest.

**Layout:**
- Full screen. No nav bar. Absolute minimal chrome.
- Top: date in small DM Mono — `Saturday, March 28` — and a subtle settings gear, top right, barely visible
- Middle: a large textarea, no border, no box — just a cursor blinking in warm white on dark background. The input *is* the screen.
- Placeholder text, disappears on first keystroke: *"What's sitting with you right now?"*
- Bottom: a soft progress bar — fills as word count approaches the 50-word floor. No number shown, just a warm line growing. When floor is met, it glows faintly in accent peach.
- Bottom right: the submit action — not a button until floor is met. Starts as a ghost, solidifies when ready. Label: `Find my parallel →`

**Micro-interactions:**
- At word 50, the progress bar pulses once and the submit button breathes in with a spring animation
- Keyboard pushes the layout up naturally (mobile keyboard handling)
- Tapping outside the textarea does nothing — no accidental dismissal

**What it explicitly does not have:** Formatting toolbar. Tags. Mood selector. Character count. Save draft button. All of these break the flow.

---

#### Screen 5 — Waiting `/waiting` ⭐ *The underrated one*

**Purpose:** Make 5 seconds feel intentional, not like a loader.

**Layout:**
- Full screen, centered
- Two abstract shapes — circles or soft polygons — one solid warm white (you), one empty/ghost (them). They orbit slowly around a center point.
- Below: a single line that cycles gently through states:
  - *"Reading your wavelength..."*
  - *"Searching for your parallel..."*
  - *"Someone is out there..."*
- No percentage. No progress bar. Just presence.

**Animation:**
- The two shapes use a slow Framer `animate` loop — orbiting, getting gradually closer
- Text fades between states every 3 seconds
- The ghost shape gradually becomes more solid as matching completes — visual metaphor for someone approaching

**When match is found:** The two shapes snap together with a spring collision. Brief flash of accent peach. Then the screen lifts away upward into the Match Reveal.

**Fallback:** If no live match in 30 seconds, the seed pool kicks in silently. The animation continues uninterrupted. User never knows.

---

#### Screen 6 — Match Reveal `/match` ⭐ *The magic moment*

**Purpose:** This is the wow. It needs its own screen, its own pacing, its own score.

**Layout:**
- The two shapes from the waiting screen are now together, centre screen
- Below them: a subtle label — `Your Parallel has arrived`
- Then: the icebreaker question fades in, large, Playfair italic, warm white — like a caption in a film
- ElevenLabs audio plays automatically — a calm voice reads the icebreaker aloud
- A small audio waveform pulses beneath the text while audio plays
- Below: the 24-hour countdown appears — `23:59:47` in DM Mono, small, muted
- Bottom: `Enter the conversation →` — held until audio finishes (or user taps to skip)

**Animation:**
- Shapes entrance: spring bounce, settle
- Label: fade in, 400ms delay
- Icebreaker text: words appear one by one, typewriter but smooth — not janky
- Audio waveform: real-time amplitude visualization
- CTA: rises from below after audio completes

**Emotional pacing:** This screen should take 10–15 seconds minimum. Don't rush it. It's the reveal.

---

#### Screen 7 — Chat `/chat/[roomId]` ⭐ *The main event*

**Purpose:** Two anonymous people talking. Get out of the way.

**Layout:**
- Top bar: the two abstract shapes side by side (your identifier + theirs) — small, ambient. Centre: countdown timer `23:41:02` in DM Mono, accent red when under 1 hour. No other header content.
- Middle: message thread. Your messages right-aligned, warm white bubbles. Their messages left-aligned, surface-coloured bubbles. No avatars. No names. No read receipts.
- Bottom: input field + send button. Input expands naturally with text. Send on return or tap.

**Message animation:**
- Each new message slides up and fades in — spring, fast (150ms)
- Your sent message animates from the input field position up into the thread

**The AI nudge:** If chat has been silent for 5 minutes, a card slides up from the bottom — not intrusive, dismissible. Styled differently from messages — centered, italic, slightly muted. Like a whisper, not an alert. Example: *"You both mentioned feeling overlooked — what did that look like today?"* Dismiss by swiping down.

**Progressive identity layer:** A subtle row of disclosure chips sits just above the input — `Share first name` / `Share city` — each one a small pill button. Tapping reveals only to the other person and shows as a gentle system message in the chat: *"They shared their name — it's Jamie."*

**What's not here:** Reactions. GIFs. Images. Voice messages. Read receipts. Online/offline status. All of these add social pressure. None of them belong.

---

#### Screen 8 — Sunset `/sunset` ⭐ *The closing moment*

**Purpose:** The chat ending should feel like an ending, not a crash.

**Trigger:** Client polls room status. When expired flag is true, `AnimatePresence` dissolves the chat screen.

**Layout:**
- The chat fades to near-black over 2 seconds — messages blur and fade, like a memory dissolving
- Then a clean screen:
  - Centre: the two shapes again, now slowly drifting apart
  - Below: `This parallel has closed.` — Playfair, italic, muted
  - Then a single question, one tap response: *"Did you feel understood?"* — two options: a quiet yes or a quiet no. No UI around it, just the question and two ghost buttons.
  - Below that: `Write again →` — back to the Write screen

**Animation:**
- Chat dissolve: Framer `AnimatePresence` exit, 800ms blur + fade
- Shapes drifting apart: slow, 2000ms, ease out
- Text: staggered fade in after shapes settle

**What it doesn't do:** Ask for a rating out of 5. Show stats. Offer to reconnect. All of these break the emotional contract.

---

#### Screen 9 — Settings `/settings`

**Purpose:** Utility only. Not a destination.

**Layout:**
- Slide-in drawer from the right (not a full page navigation)
- Notification preferences toggle
- Safety: `Report this conversation` (only visible during active chat)
- `Delete my account` — visible, not hidden
- At the bottom in small muted mono: `X conversations. All gone forever.` — just a number. No content. A small, meaningful piece of identity.

---

### Transition Map

```
Landing          → How It Works    : slide left
How It Works     → Auth            : slide left
Auth             → Write           : fade (fresh start feeling)
Write            → Waiting         : vertical lift upward
Waiting          → Match Reveal    : vertical lift upward (continuation)
Match Reveal     → Chat            : slide left (entering a space)
Chat             → Sunset          : dissolve (not a navigation, a death)
Sunset           → Write           : fade (rebirth)
Any screen       → Settings        : drawer slide from right
```

---

### Mobile-Specific Considerations

- Minimum tap target 44px on all interactive elements
- Input field tested with iOS Safari keyboard behaviour — layout must not break
- `viewport` meta tag with `user-scalable=no` — prevent accidental zoom
- `theme-color` meta set to `#0A0908` — status bar matches app on Android
- All scroll areas use `-webkit-overflow-scrolling: touch`
- PWA manifest: `display: standalone`, `orientation: portrait`

---

### What You're Not Designing

- Empty states (seed pool means you never truly wait)
- Error screens (beyond a minimal toast for network failure)
- Onboarding tutorial (How It Works screen handles this)
- Desktop layout (judges will see mobile, optimize for that only)

---

### Build Priority for Frontend

| Hour | Screen |
|------|--------|
| 0–2 | Design system — colours, fonts, base components in Tailwind |
| 2–4 | Write screen — this must be perfect |
| 4–5 | Auth + Landing |
| 5–6 | Waiting screen animation |
| 6–7 | Match Reveal + ElevenLabs audio |
| 7–10 | Chat screen — messages, timer, Supabase wired in |
| 10–11 | Sunset screen |
| 11–13 | How It Works + Settings drawer |
| 13–16 | Transitions, polish, mobile testing |
| 16–20 | P1 features, edge cases, demo rehearsal |
