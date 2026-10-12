import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { listFeed } from '@/lib/integrations/zapier-feed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admins only' }, { status: 403 });
  return NextResponse.json({ feed: await listFeed() });
}
