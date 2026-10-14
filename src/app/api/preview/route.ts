// Super admins: /api/preview?as=<person id> starts previewing that person; /api/preview?exit=1 stops.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getViewer, previewSignature } from '@/lib/auth/current-user';
import { PREVIEW_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { personById } from '@/config/people';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const viewer = await getViewer();
  const home = new URL('/', url.origin);
  if (!viewer) return NextResponse.redirect(new URL('/login', url.origin));

  if (url.searchParams.get('exit')) {
    const res = NextResponse.redirect(home);
    res.cookies.set(PREVIEW_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  if (viewer.real.role !== 'super_admin') return NextResponse.json({ error: 'Only super admins can preview' }, { status: 403 });
  const as = personById(url.searchParams.get('as') ?? '');
  if (!as || as.id === viewer.real.id) {
    const res = NextResponse.redirect(home);
    res.cookies.set(PREVIEW_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }
  const res = NextResponse.redirect(new URL(`/w/${as.departments[0]}`, url.origin));
  res.cookies.set(PREVIEW_COOKIE, `${as.id}.${await previewSignature(viewer.real.id, as.id)}`, { ...sessionCookieOptions, maxAge: 60 * 60 * 8 });
  await cookies(); // keep this route dynamic
  return res;
}
