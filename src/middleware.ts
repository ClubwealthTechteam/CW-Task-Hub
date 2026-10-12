// Every page and API route needs a valid session, except the login page and its API.
// Fine-grained checks (which department, which automation) happen in the pages and routes.

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// /api/chat/reply is called by the CW Assistant routine, which proves itself with a per-message token.
const PUBLIC = ['/login', '/api/auth/login', '/api/health', '/api/chat/reply'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/|favicon.ico|icon.svg).*)'] };
