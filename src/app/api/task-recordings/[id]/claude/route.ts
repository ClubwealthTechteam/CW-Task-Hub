// The Claude routine's side of a Task Recording write-up (see src/lib/task-recordings/routine.ts). Both calls
// carry the token from the routine's links, which works only for this recording while it is being written.
// GET: the recording (steps, notes, marked clicks), the instructions and the answer's shape, and the team's
// known spreadsheets. POST: the write-up, checked and tidied before it's saved; Miguel is notified.

import { NextResponse } from 'next/server';
import { getRecording, saveRecording } from '@/lib/task-recordings/store';
import { SCHEMA, SYSTEM, describe, finishWriteUp } from '@/lib/task-recordings/write-up';
import { fillSheetLinks, knownSheets } from '@/lib/task-recordings/sheet-links';
import { notifyWritten, validToken } from '@/lib/task-recordings/routine';
import { personById } from '@/config/people';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

async function load(req: Request, props: Props) {
  const rec = await getRecording((await props.params).id);
  const t = new URL(req.url).searchParams.get('token') ?? '';
  return rec && (await validToken(rec, t)) ? rec : null;
}

export async function GET(req: Request, props: Props) {
  const rec = await load(req, props);
  if (!rec) return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 403 });
  const sheets = (await knownSheets().catch(() => [])).slice(0, 200).map((s) => ({ name: s.name, url: s.url }));
  return NextResponse.json({
    ok: true,
    recording: {
      id: rec.id,
      recordedBy: personById(rec.owner)?.name ?? rec.owner,
      recordedWith: rec.source === 'screen' ? 'screen sharing (no-download recorder)' : 'the CW Task Recorder extension',
      title: rec.title,
      about: rec.about,
      steps: rec.steps.map((s) => ({ n: s.n, hasShot: s.hasShot, line: describe(s) })),
    },
    knownSpreadsheets: sheets,
    instructions: SYSTEM,
    answerSchema: SCHEMA,
  });
}

export async function POST(req: Request, props: Props) {
  const rec = await load(req, props);
  if (!rec) return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 600_000) return NextResponse.json({ ok: false, error: 'Write-up too large' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'Send JSON' }, { status: 400 }); }
  let w;
  try { w = await fillSheetLinks(finishWriteUp(rec, body)); } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'That write-up can’t be used' }, { status: 400 });
  }
  const first = !rec.writeUp;
  await saveRecording({ ...rec, title: w.title || rec.title, status: 'ready', writeUp: w, error: undefined });
  if (first) await notifyWritten(rec, w);
  return NextResponse.json({ ok: true, steps: w.steps.length });
}
