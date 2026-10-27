// Task Recording: the CW Task Recorder extension starts a recording here (its steps, without screenshots),
// then uploads each screenshot to /api/task-recordings/<id>/shots/<n> and asks for the write-up at
// /api/task-recordings/<id>/write. GET tells the extension who is signed in, with their recent recordings.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { cleanStep, listRecordings, MAX_STEPS, newRecordingId, saveRecording, type RawStep } from '@/lib/task-recordings/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const recordings = (await listRecordings(user)).slice(0, 10);
  return NextResponse.json({ user: { id: user.id, name: user.name }, recordings });
}

/** { title?, about?, steps: RawStep[] } → { id } */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to the Admin Hub first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.steps) ? body.steps : [];
  if (!raw.length) return NextResponse.json({ error: 'This recording has no steps' }, { status: 400 });
  if (raw.length > MAX_STEPS) return NextResponse.json({ error: `A recording can have up to ${MAX_STEPS} steps. Split the task into two recordings.` }, { status: 400 });
  const steps = raw.map((s, i) => cleanStep(s, i + 1)).filter(Boolean) as RawStep[];
  const id = newRecordingId();
  await saveRecording({
    id, owner: user.id, at: Date.now(),
    title: String(body.title ?? '').trim().slice(0, 120) || 'Recorded task',
    about: String(body.about ?? '').trim().slice(0, 1000),
    steps, status: 'uploading',
  });
  return NextResponse.json({ id });
}
