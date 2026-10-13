// Edit an opportunity (member, SMS, status, details) or remove it.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome as canUseReferrals } from '@/lib/welcome/access';
import { listOpps, OPP_STATUSES, saveOpps, type Opportunity } from '@/lib/referrals/store';

export const dynamic = 'force-dynamic';

async function allowed() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canUseReferrals(user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user };
}

const TEXT = { need: 140, service: 60, city: 60, state: 30, sms: 600, poster: 80, group: 120 } as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await allowed();
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const list = await listOpps();
  const i = list.findIndex((o) => o.id === params.id);
  if (i < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const patch: Partial<Opportunity> = {};
  for (const [k, max] of Object.entries(TEXT)) if (b[k] !== undefined) (patch as Record<string, string>)[k] = String(b[k] ?? '').slice(0, max);
  if (b.memberId !== undefined) patch.memberId = Number.isInteger(Number(b.memberId)) && Number(b.memberId) > 0 ? Number(b.memberId) : undefined;
  if (b.status !== undefined) {
    if (!OPP_STATUSES.includes(b.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    patch.status = b.status;
  }
  list[i] = { ...list[i], ...patch, updated: Date.now() };
  await saveOpps(list);
  return NextResponse.json({ opp: list[i] });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await allowed();
  if (error) return error;
  await saveOpps((await listOpps()).filter((o) => o.id !== params.id));
  return NextResponse.json({ ok: true });
}
