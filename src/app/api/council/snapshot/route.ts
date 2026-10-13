// The read-only picture of the hub the council works from. Only with a run's own token.

import { NextResponse } from 'next/server';
import { validRun } from '@/lib/council/store';
import { buildSnapshot } from '@/lib/council/snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!(await validRun(q.get('run') ?? '', q.get('token') ?? ''))) return NextResponse.json({ error: 'Invalid or expired run token' }, { status: 403 });
  return NextResponse.json(await buildSnapshot());
}
