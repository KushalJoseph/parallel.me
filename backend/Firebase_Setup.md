# Firebase Authentication Setup — Parallel Me

This document explains the full Firebase migration that was completed and the exact steps you need to take to get the app running.

---

## What Was Done (Code Changes Summary)

The project was migrated from **Auth0** to **Firebase Authentication (Google only)**. Here's what changed at a glance:

| Layer | Before | After |
|---|---|---|
| Frontend auth library | `@auth0/nextjs-auth0` | `firebase` (client SDK) |
| Session model | Server-side cookies (Auth0 middleware) | Client-side Firebase ID tokens |
| Token delivery to backend | `auth0.getSession().tokenSet.accessToken` | `auth.currentUser.getIdToken()` |
| Backend verification | Auth0 JWKS + PyJWT RS256 | `firebase_admin.auth.verify_id_token()` |
| Backend auth package | `auth0-server-python` | `firebase-admin` |
| Middleware (`proxy.ts`) | Auth0 session management | Transparent passthrough (no-op) |
| `/auth` page | Google + Apple + Email buttons (all via Auth0) | Single Google sign-in popup (Firebase) |

The auth contract between frontend and backend is **identical** — a `Bearer <token>` in the `Authorization` header. Only the token issuer changed (Auth0 → Firebase).

---

## What You Need To Do

### Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it `parallel-me` (or any name you like)
4. On the Google Analytics screen — click **"Continue"** then **"Create project"** (analytics is optional and not used)
5. Wait ~30 seconds for the project to provision, then click **"Continue"**

---

### Step 2 — Enable Google Sign-In

1. In the left sidebar, click **"Build" → "Authentication"**
2. Click **"Get started"** (first time only)
3. Click the **"Sign-in method"** tab
4. Click **"Google"** in the provider list
5. Toggle the **Enable** switch to **on**
6. Set a **Project support email** (use your Google account email)
7. Click **"Save"**

---

### Step 3 — Register Your Web App (Frontend Config)

1. Go to **Project Overview** (click the Firebase logo top-left)
2. Click the **`</>`** (Web) icon to add a web app
3. Name it `parallel-frontend`
4. **Do NOT check** "Also set up Firebase Hosting"
5. Click **"Register app"**
6. You'll see a code block like this — **copy these values**:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "parallel-me-xxxxx.firebaseapp.com",
  projectId: "parallel-me-xxxxx",
  storageBucket: "parallel-me-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. Click **"Continue to console"**

---

### Step 4 — Fill in `frontend/.env.local`

Open `frontend/.env.local` and paste in the values from Step 3:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gkdwctfltzmsarmjznbf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_1zSt0lqQj57_82kOQeGdsw_CzoGkBHe

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Firebase — paste from Step 3
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=parallel-me-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=parallel-me-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=parallel-me-xxxxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **Note:** All `NEXT_PUBLIC_FIREBASE_*` values are safe to expose — they are public by design. Firebase security is enforced through Authentication rules and your backend token verification, not through these keys.

---

### Step 5 — Generate a Service Account Key (Backend)

This is the private key your FastAPI backend uses to verify Firebase tokens.

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview" → **"Project settings"**
2. Click the **"Service accounts"** tab
3. Make sure **"Firebase Admin SDK"** is selected, and **Python** is chosen in the language dropdown
4. Click **"Generate new private key"**
5. Click **"Generate key"** in the confirmation dialog
6. A `.json` file will download — rename it to `firebase-service-account.json`
7. Move it into the `backend/` directory:

```
backend/
├── firebase-service-account.json   ← place it here
├── auth.py
├── main.py
...
```

> ⚠️ **This file is a secret.** It is already in `.gitignore` and must never be committed to version control or shared publicly.

---

### Step 6 — Add Authorized Domain for Local Dev

Firebase blocks sign-in popups from unrecognized domains by default.

1. In Firebase Console → **Authentication → Settings** tab
2. Under **"Authorized domains"**, verify `localhost` is in the list
3. It should be there by default. If not, click **"Add domain"** and add `localhost`

---

### Step 7 — Install Backend Dependencies

The `firebase-admin` package was already installed during the migration. If you're setting up on a new machine:

```bash
cd backend
source venv/bin/activate      # or venv\Scripts\activate on Windows
pip install firebase-admin
# Or reinstall everything:
pip install -r requirements.txt
```

---

### Step 8 — Verify `backend/.env`

Your `backend/.env` should contain:

```env
PORT=8000
ENVIRONMENT=development
TESTING=false

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json

# MongoDB
MONGODB_URI=mongodb+srv://...

# LLM, Audio & Proxy
GEMINI_API_KEY=...
LAVA_SECRET_KEY=...
```

The `AUTH0_*` variables have been removed. The only auth configuration now is `FIREBASE_SERVICE_ACCOUNT_PATH`.

---

### Step 9 — Run the App

**Backend:**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Frontend (new terminal):**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Step 10 — Test the Full Flow

1. Navigate to `/auth`
2. Click **"Continue with Google"** — a Google sign-in popup should appear
3. Sign in with your Google account
4. You should be redirected to `/write`
5. Submit a journal entry — the backend should return `200` with the entry stored under your Firebase UID

---

## How Authentication Works (Reference)

```
User clicks "Continue with Google"
        │
        ▼
Firebase client SDK → signInWithPopup(auth, GoogleAuthProvider)
        │
        ├── Google OAuth popup opens
        ├── User grants permission
        └── Firebase mints a signed ID token (JWT, valid 1 hour)
                │
                ▼
        auth.currentUser.getIdToken()
                │
                ▼
        Frontend sends: Authorization: Bearer <Firebase ID Token>
                │
                ▼
        FastAPI backend receives the token
                │
                ▼
        firebase_admin.auth.verify_id_token(token)
                │
                ├── Verifies signature using Firebase's public JWKS
                ├── Checks token is not expired
                └── Returns decoded payload { uid: "abc123...", email: "..." }
                        │
                        ▼
                get_current_user_id() returns uid
                        │
                        ▼
                uid used as userId in MongoDB documents
```

Firebase automatically refreshes the ID token every hour via the client SDK. Your app does not need to handle token refresh manually.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "Firebase: Error (auth/unauthorized-domain)" | `localhost` not in Authorized Domains | Add `localhost` in Firebase Console → Auth → Settings |
| Backend returns `401 Invalid token` | Service account file missing or wrong path | Check `firebase-service-account.json` is in `backend/` and `FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json` is in `.env` |
| Backend returns `500` on startup | `firebase-service-account.json` not found | Make sure the file exists in the `backend/` directory |
| Google popup closes immediately | Browser popup blocked | Allow popups for `localhost` in your browser settings |
| `Cannot find module 'firebase/auth'` in TS | Firebase not installed | Run `npm install` in `frontend/` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` is undefined | `.env.local` not filled in | Fill in all `NEXT_PUBLIC_FIREBASE_*` values and restart `npm run dev` |
