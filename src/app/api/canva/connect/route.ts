// Starts connecting a person's Canva account (OAuth with PKCE). Only the people in CANVA_USERS.

import { NextResponse } from 'next/server';
import { getCurrentUser, getViewer } from '@/lib/auth/current-user';
import { authorizeUrl, canUseCanva, canvaConfigured } from '@/lib/canva/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if ((await getViewer())?.preview) return NextResponse.json({ error: 'Not while previewing someone' }, { status: 403 });
  if (!canUseCanva(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canvaConfigured()) return NextResponse.json({ error: 'Canva isn’t set up in the hub yet (CANVA_CLIENT_ID and CANVA_CLIENT_SECRET)' }, { status: 503 });
  const back = new URL(req.url).searchParams.get('return') ?? '';
  const returnTo = back.startsWith('/w/') ? back : `/w/${user.departments[0]}`;
  return NextResponse.redirect(await authorizeUrl(user.id, returnTo));
}
