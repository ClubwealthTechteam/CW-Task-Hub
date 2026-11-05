// Each Claude routine posts its own run here as it finishes (ROUTINES_REPORT_SECRET, added by the cloud
// environment for /api/routines/report*). Body: { id, name, ok, summary, startedAt? }. Write-only.

import { NextResponse } from 'next/server';
import { saveRun } from '@/lib/routines/status';
import { reportAllowed } from '../auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!process.env.ROUTINES_REPORT_SECRET) return NextResponse.json({ error: 'Add ROUTINES_REPORT_SECRET in Vercel' }, { status: 503 });
  if (!reportAllowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const run = await saveRun(await req.json().catch(() => null));
  if (!run) return NextResponse.json({ error: 'Send the routine id (trig_…)' }, { status: 400 });
  return NextResponse.json({ saved: true, status: run.status });
}
