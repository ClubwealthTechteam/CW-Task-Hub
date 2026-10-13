// Every page and API route needs a valid session, except the login page and its API.
// Fine-grained checks (which department, which automation) happen in the pages and routes.

import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE, SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// /api/chat/reply is called by the CW Assistant routine, which proves itself with a per-message token.
// /api/zapier/inbox is called by Zaps, which prove themselves with ZAPIER_INBOUND_SECRET.
const PUBLIC = ['/login', '/api/auth/login', '/api/health', '/api/chat/reply', '/api/zapier/inbox'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    // "Preview as" is read-only: nothing can be sent, saved or deleted while previewing someone.
    const writing = !['GET', 'HEAD'].includes(req.method) && !pathname.startsWith('/api/preview') && pathname !== '/api/auth/logout';
    if (writing && req.cookies.get(PREVIEW_COOKIE)?.value) {
      return NextResponse.json({ error: 'You’re previewing someone’s view, which is read-only. Exit the preview to make changes.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/|favicon.ico|icon.svg).*)'] };
