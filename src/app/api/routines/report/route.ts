// Called by the "Routines status → hub" Claude routine (every 2 hours on weekdays) with ROUTINES_REPORT_SECRET.
// The secret only lets it post the routines' status; it can't read anything from the hub.

import { NextResponse } from 'next/server';
import { cleanReport, saveReport } from '@/lib/routines/status';

export const dynamic = 'force-dynamic';

function allowed(req: Request) {
  const secret = process.env.ROUTINES_REPORT_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || secret.length < 16 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  if (!process.env.ROUTINES_REPORT_SECRET) return NextResponse.json({ error: 'Add ROUTINES_REPORT_SECRET in Vercel' }, { status: 503 });
  if (!allowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const routines = cleanReport(body);
  if (!routines.length) return NextResponse.json({ error: 'No routines in the report' }, { status: 400 });
  const r = await saveReport(routines);
  return NextResponse.json({ saved: r.routines.length, at: r.at });
}
