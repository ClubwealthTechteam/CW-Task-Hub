// Disconnects this person's Canva account from the hub (and tells Canva to revoke the hub's access).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseCanva, disconnect } from '@/lib/canva/client';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCanva(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await disconnect(user.id);
  return NextResponse.json({ ok: true });
}
