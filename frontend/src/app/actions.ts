"use server";

import { auth0 } from "@/lib/auth0";

async function getAuthToken() {
  const session = await auth0.getSession();
  if (!session || !session.tokenSet) {
    throw new Error("Unauthorized");
  }
  return session.tokenSet.accessToken;
}

export async function getUserId() {
  const session = await auth0.getSession();
  if (!session || !session.user) return null;
  return session.user.sub;
}

export async function getUser() {
  const session = await auth0.getSession();
  if (!session || !session.user) return null;
  const { sub, name, email, picture } = session.user;
  return {
    id: sub as string,
    name: (name ?? null) as string | null,
    email: (email ?? null) as string | null,
    picture: (picture ?? null) as string | null,
  };
}

export async function submitEntry(text: string) {
  const token = await getAuthToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/entry`, {
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

export async function pollEntry(entryId: string) {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/entry/${entryId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function getRoom(roomId: string) {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/room/${roomId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function getMessages(roomId: string) {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/room/${roomId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

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

export async function getUserConversations(): Promise<ConversationItem[]> {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/user/conversations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function sendMessage(roomId: string, message: any) {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/room/${roomId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function connectRoom(roomId: string) {
  const token = await getAuthToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/room/${roomId}/connect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
