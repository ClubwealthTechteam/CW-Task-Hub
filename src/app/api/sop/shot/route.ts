// SOP Handbook: paste or remove a step's screenshot (Miguel only, see SHOT_EDITORS in src/lib/sop.ts).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sopById } from '@/data/sop';
import { canEditShots, deleteSopShot, setSopShot, setSopShotSize, SHOT_SIZES, SHOT_SLOTS, type ShotSize, type ShotSlot } from '@/lib/sop';

export const dynamic = 'force-dynamic';

async function target(id: unknown, step: unknown, slot: unknown) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canEditShots(user.id)) return { error: NextResponse.json({ error: 'Only Miguel can add screenshots' }, { status: 403 }) };
  const article = sopById(String(id ?? ''));
  const n = Number(step);
  const k = Number(slot ?? 1) as ShotSlot;
  if (!article || !Number.isInteger(n) || n < 1 || n > article.steps.length || !SHOT_SLOTS.includes(k)) return { error: NextResponse.json({ error: 'That step doesn’t exist' }, { status: 404 }) };
  return { article, n, k };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const t = await target(body.id, body.step, body.slot);
  if (t.error) return t.error;
  const problem = await setSopShot(t.article.id, t.n, t.k, String(body.dataUrl ?? ''));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Change how wide a screenshot shows: { id, step, slot, size: 's' | 'm' | 'l' | 'full' }. */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const t = await target(body.id, body.step, body.slot);
  if (t.error) return t.error;
  if (!SHOT_SIZES.includes(body.size)) return NextResponse.json({ error: 'Pick Small, Medium, Large or Full width' }, { status: 400 });
  await setSopShotSize(t.article.id, t.n, t.k, body.size as ShotSize);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams;
  const t = await target(q.get('id'), q.get('step'), q.get('slot'));
  if (t.error) return t.error;
  await deleteSopShot(t.article.id, t.n, t.k);
  return NextResponse.json({ ok: true });
}
