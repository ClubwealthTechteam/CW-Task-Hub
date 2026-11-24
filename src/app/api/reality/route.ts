// The REality page's API (Am and super admins). GET: the batches with each email's preview.
// POST { id, leaveOut: [sheet rows] }: approves the batch and starts the routine that sends it.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { allBatches, approveBatch, canUseReality } from '@/lib/reality/batches';
import { realityEmail, REALITY_CC, REALITY_FROM } from '@/lib/reality/email';
import { fireRealityRoutine, realityRoutineConfigured } from '@/lib/reality/routine';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canUseReality(user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const batches = (await allBatches()).slice(-20).reverse().map((b) => ({
    ...b, people: b.people.map((p) => ({ ...p, preview: realityEmail(p.first, p.location).html })),
  }));
  return NextResponse.json({ batches, from: REALITY_FROM, cc: REALITY_CC, routine: realityRoutineConfigured() });
}

export async function POST(req: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const leaveOut = Array.isArray(b.leaveOut) ? b.leaveOut.filter((n): n is number => Number.isInteger(n)) : [];
  const done = await approveBatch(String(b.id ?? ''), g.user, leaveOut);
  if ('error' in done) return NextResponse.json({ error: done.error }, { status: 409 });
  const count = done.batch.people.filter((p) => p.status === 'waiting').length;
  let started = false;
  if (realityRoutineConfigured()) {
    started = await fireRealityRoutine(`REality batch ${done.batch.id} approved in the hub by ${g.user.name} (${count} to email). Send it now.`)
      .then(() => true).catch(() => false);
  }
  return NextResponse.json({ id: done.batch.id, count, started });
}
