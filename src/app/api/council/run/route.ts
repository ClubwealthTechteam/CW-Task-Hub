// Starts a council run: POST from a super admin ("Run the council now"), or GET from the daily Vercel cron
// (which sends "Authorization: Bearer <CRON_SECRET>").

import { NextResponse } from 'next/server';
import { getCurrentUser, getViewer } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { councilConfigured, startRun } from '@/lib/council/run';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  if (!councilConfigured()) return NextResponse.json({ error: 'Council not set up' }, { status: 503 });
  const { run, started } = await startRun('schedule');
  return NextResponse.json({ run: run.id, started });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isSuperAdmin(user) || (await getViewer())?.preview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!councilConfigured()) return NextResponse.json({ error: 'The council isn’t set up yet (CLAUDE_COUNCIL_ROUTINE_TOKEN)' }, { status: 503 });
  const { run, started } = await startRun(user);
  return NextResponse.json({ run, started }, { status: run.status === 'error' ? 502 : 200 });
}
