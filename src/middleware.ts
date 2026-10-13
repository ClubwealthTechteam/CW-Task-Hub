// Every page and API route needs a valid session, except the login page and its API.
// Fine-grained checks (which department, which automation) happen in the pages and routes.

import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE, SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// /api/chat/reply is called by the CW Assistant routine, which proves itself with a per-message token.
// /api/zapier/inbox is called by Zaps, which prove themselves with ZAPIER_INBOUND_SECRET.
// /api/chat/reply/file is how the routine sends a graphic it made (same per-message token).
// /api/chat/files/<id>?t=… is how the routine reads an attached file (a signed link per file).
// /api/chat/reply/canva is how the routine puts a design into the person's Canva (same token).
const PUBLIC = ['/login', '/api/auth/login', '/api/health', '/api/chat/reply', '/api/chat/reply/file', '/api/chat/reply/canva', '/api/zapier/inbox'];
const signedFile = (req: NextRequest) => req.nextUrl.pathname.startsWith('/api/chat/files/') && req.method === 'GET' && req.nextUrl.searchParams.has('t');

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p) || signedFile(req)) return NextResponse.next();

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
