/**
 * API helpers for communicating with the FastAPI backend.
 *
 * These are plain async functions (NOT Server Actions) because Firebase ID tokens
 * are available client-side only. Each function accepts a `token` argument obtained
 * from `useAuth().getIdToken()` in the calling component.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Auth helpers — now resolved client-side via Firebase
// ---------------------------------------------------------------------------

/** Returns the current Firebase user ID from the decoded token header. */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    // Firebase ID tokens are JWTs — decode the payload (no verification needed client-side)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? payload.user_id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry API
// ---------------------------------------------------------------------------

export async function submitEntry(token: string, text: string) {
  const res = await fetch(`${API_URL}/api/entry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function pollEntry(token: string, entryId: string) {
  const res = await fetch(`${API_URL}/api/entry/${entryId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Room API
// ---------------------------------------------------------------------------

export async function getRoom(token: string, roomId: string) {
  const res = await fetch(`${API_URL}/api/room/${roomId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function getMessages(token: string, roomId: string) {
  const res = await fetch(`${API_URL}/api/room/${roomId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function sendMessage(token: string, roomId: string, message: unknown) {
  const res = await fetch(`${API_URL}/api/room/${roomId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function connectRoom(token: string, roomId: string) {
  const res = await fetch(`${API_URL}/api/room/${roomId}/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteRoom(token: string, roomId: string) {
  const res = await fetch(`${API_URL}/api/room/${roomId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// User / Conversations API
// ---------------------------------------------------------------------------

export type ConversationItem =
  | {
      type: "pending";
      entryId: string;
      title: string;
      createdAt: string;
    }
  | {
      type: "active";
      roomId: string;
      title: string;
      icebreakerPreview: string;
      expiresAt: string;
      createdAt: string;
      isPermanent?: boolean;
    };

export async function getUserConversations(token: string): Promise<ConversationItem[]> {
  const res = await fetch(`${API_URL}/api/user/conversations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
