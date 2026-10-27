// Once every screenshot is uploaded, the recorder asks for the write-up. With the Claude routine set up
// (CLAUDE_RECORDING_ROUTINE_TOKEN) the recording is sent to Claude, which posts the steps back to
// /api/task-recordings/<id>/claude a few minutes later; otherwise the hub writes it here (with Claude only if
// ANTHROPIC_API_KEY is set, else a basic write-up). Miguel gets a notification with the link. Running it again
// rewrites it (the recorder or a super admin).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canView, getRecording, saveRecording } from '@/lib/task-recordings/store';
import { writeUp } from '@/lib/task-recordings/write-up';
import { fireRecordingRoutine, notifyWritten, routineConfigured } from '@/lib/task-recordings/routine';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rec = await getRecording(id);
  if (!rec || !canView(user, rec)) return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  if (rec.status === 'writing' && Date.now() - (rec.writingAt ?? rec.at) < 10 * 60_000) {
    return NextResponse.json({ error: 'Claude is already writing this one' }, { status: 409 });
  }
  const href = `/task-recordings/${id}`;

  if (routineConfigured()) {
    const sent = { ...rec, status: 'writing' as const, writingAt: Date.now(), error: undefined };
    await saveRecording(sent);
    try {
      await fireRecordingRoutine(sent);
      return NextResponse.json({ ok: true, queued: true, href });
    } catch (e) {
      const problem = e instanceof Error ? e.message : 'Claude couldn’t be reached';
      await logError('server', `Task Recording: ${problem}`, { path: `/api/task-recordings/${id}/write` });
      await saveRecording({ ...rec, status: rec.writeUp ? 'ready' : 'error', error: problem });
      return NextResponse.json({ error: `${problem}. Try again in a minute.` }, { status: 502 });
    }
  }

  const first = !rec.writeUp;
  await saveRecording({ ...rec, status: 'writing', writingAt: Date.now(), error: undefined });
  const { writeUp: w, problem } = await writeUp(rec);
  const done = { ...rec, title: w.title || rec.title, status: 'ready' as const, writeUp: w, error: problem };
  await saveRecording(done);
  if (first) await notifyWritten(rec, w);
  return NextResponse.json({ ok: true, by: w.by, problem, href });
}
