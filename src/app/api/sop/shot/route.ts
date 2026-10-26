// SOP Handbook: paste or remove a step's screenshot (Miguel only, see SHOT_EDITORS in src/lib/sop.ts).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sopById } from '@/data/sop';
import { canEditShots, deleteSopShot, setSopShot } from '@/lib/sop';

export const dynamic = 'force-dynamic';

async function target(id: unknown, step: unknown) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canEditShots(user.id)) return { error: NextResponse.json({ error: 'Only Miguel can add screenshots' }, { status: 403 }) };
  const article = sopById(String(id ?? ''));
  const n = Number(step);
  if (!article || !Number.isInteger(n) || n < 1 || n > article.steps.length) return { error: NextResponse.json({ error: 'That step doesn’t exist' }, { status: 404 }) };
  return { article, n };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const t = await target(body.id, body.step);
  if (t.error) return t.error;
  const problem = await setSopShot(t.article.id, t.n, String(body.dataUrl ?? ''));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams;
  const t = await target(q.get('id'), q.get('step'));
  if (t.error) return t.error;
  await deleteSopShot(t.article.id, t.n);
  return NextResponse.json({ ok: true });
}
