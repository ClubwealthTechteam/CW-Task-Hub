// SOP Handbook: a Main Admin marks themselves out (or back in) for today, so their tasks show their POC.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { setOut } from '@/lib/sop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await setOut(user.id, Boolean(body.out));
  return NextResponse.json({ ok: true });
}
