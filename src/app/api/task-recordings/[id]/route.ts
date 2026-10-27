// One Task Recording: read it (the recorder or a super admin), or delete it (same people).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canView, deleteRecording, getRecording } from '@/lib/task-recordings/store';

export const dynamic = 'force-dynamic';

async function load(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  const rec = await getRecording(id);
  if (!rec || !canView(user, rec)) return { error: NextResponse.json({ error: 'Recording not found' }, { status: 404 }) };
  return { rec };
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await load((await props.params).id);
  if (r.error) return r.error;
  return NextResponse.json(r.rec);
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await load((await props.params).id);
  if (r.error) return r.error;
  await deleteRecording(r.rec);
  return NextResponse.json({ ok: true });
}
