// Whether this person can use Canva in the hub, and whether their account is connected.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseCanva, canvaConfigured, status } from '@/lib/canva/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseCanva(user)) return NextResponse.json({ allowed: false });
  return NextResponse.json({ allowed: true, configured: canvaConfigured(), ...(canvaConfigured() ? await status(user.id) : { connected: false }) });
}
