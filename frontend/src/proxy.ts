import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Middleware — Firebase auth is client-side (Firebase SDK + onAuthStateChanged).
 * Server-side route protection is enforced at the FastAPI backend via Firebase token
 * verification. This middleware simply passes all requests through.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
