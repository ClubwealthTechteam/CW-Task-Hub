// Super admins: copy every submitted EOD report to the EOD Google Sheet again (e.g. right after sharing it).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canReadAllEod } from '@/lib/eod/store';
import { syncAllEodSheet } from '@/lib/eod/sheet';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canReadAllEod(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ sheet: await syncAllEodSheet() });
}
