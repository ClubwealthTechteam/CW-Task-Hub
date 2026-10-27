// Sends a recording to the "CW Task Recording write-up" Claude routine, so the write-up runs on the team's
// Claude plan with no Anthropic API key (and no separate bill): the hub fires the routine with links that carry
// a token for this one recording; Claude reads the steps and screenshots from /api/task-recordings/<id>/claude
// and posts the write-up back there. Needs only the routine's own token (CLAUDE_RECORDING_ROUTINE_TOKEN).

import { signValue } from '@/lib/auth/session';
import { notify } from '@/lib/notifications';
import { personById } from '@/config/people';
import type { Recording, WriteUp } from './store';

const DEFAULT_ROUTINE_ID = 'trig_012FUuGmevvGwFcLcGeQHFcH'; // "CW Task Recording write-up" routine
const HUB = () => process.env.HUB_URL || 'https://cw-admin-hub.vercel.app';
/** A recording's links stop working this long after it was sent to Claude. */
const TOKEN_HOURS = 6;
/** Who hears about every new recording. */
export const SEND_TO = 'miguel';

export const routineConfigured = () => Boolean(process.env.CLAUDE_RECORDING_ROUTINE_TOKEN);

const token = (rec: Pick<Recording, 'id' | 'writingAt'>) => signValue(`trec-claude:${rec.id}:${rec.writingAt ?? 0}`);

/** Whether `t` is the token for this recording's current write-up request (and it hasn't expired). */
export async function validToken(rec: Recording, t: string) {
  if (!t || rec.status !== 'writing' || !rec.writingAt || Date.now() - rec.writingAt > TOKEN_HOURS * 3_600_000) return false;
  const expected = await token(rec);
  if (expected.length !== t.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ t.charCodeAt(i);
  return diff === 0;
}

/** Fires the routine for a recording already saved with status "writing" and its writingAt. */
export async function fireRecordingRoutine(rec: Recording) {
  const t = encodeURIComponent(await token(rec));
  const base = `${HUB()}/api/task-recordings/${rec.id}/claude`;
  const text = [
    'CW Task Recording write-up (sent by the Task Hub).',
    `RECORDING_ID: ${rec.id}`,
    `DATA: ${base}?token=${t}`,
    `SHOT: ${base}/shots/<n>?token=${t}`,
    `RESULT: POST ${base}?token=${t}`,
  ].join('\n');
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${process.env.RECORDING_ROUTINE_ID || DEFAULT_ROUTINE_ID}/fire`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLAUDE_RECORDING_ROUTINE_TOKEN}`,
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Claude couldn’t be reached (${res.status})`);
}

/** Tells Miguel about a recording's first write-up. */
export async function notifyWritten(rec: Recording, w: WriteUp) {
  if (rec.owner === SEND_TO) return;
  await notify(SEND_TO, {
    kind: 'update',
    title: `New task recording · ${w.title || rec.title}`,
    body: `${personById(rec.owner)?.name ?? rec.owner} recorded ${w.steps.length} steps. Copy the Flow Canvas JSON from the recording.`,
    href: `/task-recordings/${rec.id}`,
  });
}
