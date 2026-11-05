// The full routines list (names, schedules), posted from a Claude chat with ROUTINES_REPORT_SECRET when
// routines change. The secret only lets it post the routines' status; it can't read anything from the hub.

import { NextResponse } from 'next/server';
import { cleanReport, saveReport } from '@/lib/routines/status';
import { reportAllowed } from './auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!process.env.ROUTINES_REPORT_SECRET) return NextResponse.json({ error: 'Add ROUTINES_REPORT_SECRET in Vercel' }, { status: 503 });
  if (!reportAllowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const routines = cleanReport(body);
  if (!routines.length) return NextResponse.json({ error: 'No routines in the report' }, { status: 400 });
  const r = await saveReport(routines);
  return NextResponse.json({ saved: r.routines.length, at: r.at });
}
