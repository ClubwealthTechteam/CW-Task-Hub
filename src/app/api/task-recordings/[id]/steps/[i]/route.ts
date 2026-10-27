// "Is this correct?" on one written step: the recorder (or a super admin) answers yes, or no with what's wrong.
// Miguel is told when a step is marked wrong; "Write it again with Claude" then fixes those steps.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { notify } from '@/lib/notifications';
import { personById } from '@/config/people';
import { getRecording, saveRecording } from '@/lib/task-recordings/store';
import { SEND_TO } from '@/lib/task-recordings/routine';

export const dynamic = 'force-dynamic';

/** { ok: boolean, note?: string } → the saved check. ok: null clears the answer. */
export async function PUT(req: Request, props: { params: Promise<{ id: string; i: string }> }) {
  const { id, i } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  if (!rec || (rec.owner !== user.id && !isSuperAdmin(user))) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  const step = rec.writeUp?.steps[Number(i)];
  if (!step || !Number.isInteger(Number(i))) return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const before = step.check;
  if (body.ok === null) {
    delete step.check;
  } else {
    if (typeof body.ok !== 'boolean') return NextResponse.json({ error: 'Answer yes or no' }, { status: 400 });
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    if (!body.ok && !note) return NextResponse.json({ error: 'Describe what’s wrong with this step' }, { status: 400 });
    step.check = { ok: body.ok, ...(body.ok ? {} : { note }), by: user.id, at: Date.now() };
  }
  await saveRecording(rec);
  if (step.check && !step.check.ok && (before?.ok !== false || before.note !== step.check.note) && user.id !== SEND_TO) {
    await notify(SEND_TO, {
      kind: 'update',
      title: `Step marked wrong · ${rec.writeUp?.title ?? rec.title}`,
      body: `${personById(user.id)?.name ?? user.id} says step ${Number(i) + 1} (“${step.title}”) isn’t right.`,
      href: `/task-recordings/${id}#step-${Number(i) + 1}`,
    });
  }
  return NextResponse.json({ ok: true, check: step.check ?? null });
}
