// Starts a council run: records it and fires the "CW Hub Council" Claude routine with a short-lived run
// token. The routine reads /api/council/snapshot and posts its report to /api/council/report.

import { logError } from '@/lib/errors';
import type { Person } from '@/config/people';
import { listRuns, newRunId, runToken, saveRuns } from './store';
import type { Run } from './agents';

const DEFAULT_ROUTINE_ID = 'trig_01WpqBqC29kwsC4Lz4HcyXUz'; // "CW Hub Council" routine
const HUB = 'https://cw-ai-task-hub.vercel.app';

export const councilConfigured = () => Boolean(process.env.CLAUDE_COUNCIL_ROUTINE_TOKEN);

export async function startRun(by: Person | 'schedule') {
  const runs = await listRuns();
  const running = runs.find((r) => r.status === 'running' && Date.now() - r.at < 45 * 60 * 1000);
  if (running) return { run: running, started: false };
  const run: Run = { id: newRunId(), at: Date.now(), by: by === 'schedule' ? 'schedule' : by.id, status: 'running' };
  const token = await runToken(run.id);
  const text = [
    'CW Hub Council run (sent by the Task Hub).',
    `RUN_ID: ${run.id}`,
    `RUN_TOKEN: ${token}`,
    `SNAPSHOT: ${HUB}/api/council/snapshot?run=${run.id}&token=${token}`,
    `KEAP_LOOKUP: ${HUB}/api/council/keap?run=${run.id}&token=${token}&q=<email or name>`,
    `REPORT: POST ${HUB}/api/council/report?run=${run.id}&token=${token}`,
    `Started by: ${by === 'schedule' ? 'the daily schedule' : by.name}`,
  ].join('\n');
  try {
    const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${process.env.COUNCIL_ROUTINE_ID || DEFAULT_ROUTINE_ID}/fire`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLAUDE_COUNCIL_ROUTINE_TOKEN}`,
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`The council couldn’t be started (${res.status}).`);
  } catch (e) {
    run.status = 'error';
    run.error = (e as Error).message;
    await logError('server', `Council: ${run.error}`, { path: '/api/council/run' });
  }
  await saveRuns([run, ...runs]);
  return { run, started: run.status === 'running' };
}
