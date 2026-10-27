// Once every screenshot is uploaded, the recorder asks for the write-up: Claude reads the steps and
// screenshots and writes the detailed steps and the summary (a basic write-up if Claude isn't available).
// Miguel gets a notification with the link. Running it again rewrites it (the recorder or a super admin).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { notify } from '@/lib/notifications';
import { personById } from '@/config/people';
import { canView, getRecording, saveRecording } from '@/lib/task-recordings/store';
import { writeUp } from '@/lib/task-recordings/write-up';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Who hears about every new recording. */
const SEND_TO = 'miguel';

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  if (!rec || !canView(user, rec)) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  if (rec.status === 'writing' && Date.now() - rec.at < 10 * 60_000 && rec.writeUp === undefined) {
    return NextResponse.json({ error: 'Claude is already writing this one' }, { status: 409 });
  }
  const first = !rec.writeUp;
  await saveRecording({ ...rec, status: 'writing', error: undefined });
  const { writeUp: w, problem } = await writeUp(rec);
  const done = { ...rec, title: w.title || rec.title, status: 'ready' as const, writeUp: w, error: problem };
  await saveRecording(done);
  if (first && rec.owner !== SEND_TO) {
    await notify(SEND_TO, {
      kind: 'update',
      title: `New task recording · ${done.title}`,
      body: `${personById(rec.owner)?.name ?? rec.owner} recorded ${w.steps.length} steps. Copy the Flow Canvas JSON from the recording.`,
      href: `/task-recordings/${id}`,
    });
  }
  return NextResponse.json({ ok: true, by: w.by, problem, href: `/task-recordings/${id}` });
}
