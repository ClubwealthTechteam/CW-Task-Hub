import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { markAllRead, notificationsFor } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  return NextResponse.json(await notificationsFor(user));
}

/** Marks everything read. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
