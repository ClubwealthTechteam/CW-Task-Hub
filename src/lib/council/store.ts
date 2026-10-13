// Council runs and reports. A run gets a short-lived signed token; the routine uses it to read the snapshot
// and post its report, so no secret ever sits in the routine's instructions.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';
import { signValue } from '@/lib/auth/session';
import type { Report, Run } from './agents';

const RUNS = 'council:runs';
const REPORTS = 'council:reports';
const TOKEN_HOURS = 3;

export const listRuns = () => getJSON<Run[]>(RUNS, []);
export const saveRuns = (r: Run[]) => setJSON(RUNS, r.slice(0, 60));
export const listReports = () => getJSON<Report[]>(REPORTS, []);
export const saveReports = (r: Report[]) => setJSON(REPORTS, r.slice(0, 30));
export const newRunId = () => `run_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

const ts = (id: string) => parseInt(id.slice(4, -6), 36);
export const runToken = (runId: string) => signValue(`council:${runId}`);
export async function validRun(runId: string, token: string) {
  if (!/^run_[a-z0-9]+$/.test(runId) || !token) return false;
  if (Date.now() - ts(runId) > TOKEN_HOURS * 3_600_000) return false;
  const expected = await runToken(runId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
