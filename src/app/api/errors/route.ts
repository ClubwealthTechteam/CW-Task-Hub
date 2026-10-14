// Browsers report page crashes here (signed-in people only; rate-limited per server instance).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const recent = new Map<string, number[]>();

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => t > now - 60_000);
  if (mine.length >= 10) return NextResponse.json({ ok: false }, { status: 429 });
  recent.set(user.id, [...mine, now]);
  const body = await req.json().catch(() => ({}));
  await logError('browser', body.message, { path: body.path, user: user.id });
  return NextResponse.json({ ok: true });
}
