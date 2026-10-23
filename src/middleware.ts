// Every page and API route needs a valid session, except the login page and its API.
// Fine-grained checks (which department, which automation) happen in the pages and routes.

import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE, SESSION_COOKIE, verifySession } from '@/lib/auth/session';
import { personById } from '@/config/people';
import { EOD_HOME, eodOnly, membersOpen } from '@/lib/access';

// /api/chat/reply is called by the CW Assistant routine, which proves itself with a per-message token.
// /api/zapier/inbox is called by Zaps, which prove themselves with ZAPIER_INBOUND_SECRET.
// /api/chat/reply/file is how the routine sends a graphic it made (same per-message token).
// /api/chat/files/<id>?t=… is how the routine reads an attached file (a signed link per file).
// /api/council/run (GET: the daily cron, checks CRON_SECRET), snapshot, keap and report use a run token.
// /api/chat/reply/canva is how the routine puts a design into the person's Canva (same token).
// /api/backup is called by the nightly GitHub Action with BACKUP_SECRET.
const PUBLIC = ['/login', '/api/auth/login', '/api/health', '/api/chat/reply', '/api/chat/reply/file', '/api/chat/reply/canva', '/api/zapier/inbox', '/api/council/snapshot', '/api/council/keap', '/api/council/report', '/api/backup'];
const councilCron = (req: NextRequest) => req.nextUrl.pathname === '/api/council/run' && req.method === 'GET';
// /celebrations/* are the public poster template, logo and scripts the Slack celebrations routine downloads.
const publicAsset = (req: NextRequest) => req.nextUrl.pathname.startsWith('/celebrations/') && req.method === 'GET';
const signedFile = (req: NextRequest) => req.nextUrl.pathname.startsWith('/api/chat/files/') && req.method === 'GET' && req.nextUrl.searchParams.has('t');

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p) || signedFile(req) || councilCron(req) || publicAsset(req)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    // "Preview as" is read-only: nothing can be sent, saved or deleted while previewing someone.
    const writing = !['GET', 'HEAD'].includes(req.method) && !pathname.startsWith('/api/preview') && pathname !== '/api/auth/logout';
    if (writing && req.cookies.get(PREVIEW_COOKIE)?.value) {
      return NextResponse.json({ error: 'You’re previewing someone’s view, which is read-only. Exit the preview to make changes.' }, { status: 403 });
    }
    // Team members only have EOD reports and the SOP Handbook for now: any other page (not files or APIs) goes to EOD.
    const page = !pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(pathname);
    if (page && !membersOpen(pathname) && eodOnly(personById(session.uid))) {
      const url = req.nextUrl.clone();
      url.pathname = EOD_HOME; url.search = '';
      return NextResponse.redirect(url);
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
