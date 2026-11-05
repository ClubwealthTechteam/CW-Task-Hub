// Status of the Club Wealth Claude routines (scheduled tasks on claude.ai), shown on Admin settings →
// Routines. The hub can't list routines itself and scheduled routines can't list each other, so:
//  - each routine posts its own run when it finishes (POST /api/routines/report/run: done or failed + summary);
//  - the full list (names, schedules) is posted to /api/routines/report from a Claude chat when routines change.
// Both use ROUTINES_REPORT_SECRET (added by the cloud environment). Next and late runs come from the schedule.

import { getJSON, setJSON } from '@/lib/store';

export interface RoutineRun { status: string; firedAt?: string; finishedAt?: string; sessionId?: string; failureReason?: string; summary?: string }
export interface RoutineStatus {
  id: string;
  name: string;
  enabled: boolean;
  cron?: string;
  runOnceAt?: string;
  nextRunAt?: string;
  lastRun?: RoutineRun;
}
export interface RoutinesReport { at: number; routines: RoutineStatus[] }

const KEY = 'routines:status';

export const routinesReport = () => getJSON<RoutinesReport | null>(KEY, null);

const str = (v: unknown, n = 200) => (typeof v === 'string' ? v.slice(0, n) : undefined) || undefined;

/** Keeps only known fields from what the reporter routine sent. */
export function cleanReport(body: unknown): RoutineStatus[] {
  const list = Array.isArray((body as { routines?: unknown })?.routines) ? (body as { routines: unknown[] }).routines : [];
  return list.slice(0, 200).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const id = str(o.id, 80), name = str(o.name, 160);
    if (!id || !name || !/^trig_[A-Za-z0-9]+$/.test(id)) return [];
    const lr = (o.lastRun ?? null) as Record<string, unknown> | null;
    return [{
      id, name, enabled: o.enabled === true,
      cron: str(o.cron, 120), runOnceAt: str(o.runOnceAt, 40), nextRunAt: str(o.nextRunAt, 40),
      lastRun: lr && str(lr.status, 60) ? {
        status: str(lr.status, 60)!, firedAt: str(lr.firedAt, 40), finishedAt: str(lr.finishedAt, 40),
        sessionId: str(lr.sessionId, 80), failureReason: str(lr.failureReason, 120),
      } : undefined,
    }];
  });
}

const runTime = (x?: RoutineRun) => Date.parse(x?.finishedAt ?? x?.firedAt ?? '') || 0;

/** Replaces the list (names, schedules) but keeps each routine's newer self-reported run. */
export async function saveReport(routines: RoutineStatus[]) {
  const old = await routinesReport();
  const byId = new Map((old?.routines ?? []).map((r) => [r.id, r]));
  const merged = routines.map((r) => {
    const prev = byId.get(r.id)?.lastRun;
    return prev && runTime(prev) > runTime(r.lastRun) ? { ...r, lastRun: prev } : r;
  });
  const report: RoutinesReport = { at: Date.now(), routines: merged };
  await setJSON(KEY, report);
  return report;
}

/** A routine reporting its own run as it finishes. Unknown routines are added by name. */
export async function saveRun(body: unknown) {
  const o = (body ?? {}) as Record<string, unknown>;
  const id = str(o.id, 80), name = str(o.name, 160);
  if (!id || !/^trig_[A-Za-z0-9]+$/.test(id)) return null;
  const now = new Date().toISOString();
  const run: RoutineRun = { status: o.ok === false ? 'FAILED' : 'SUCCEEDED', firedAt: str(o.startedAt, 40) ?? now, finishedAt: now, summary: str(o.summary, 300) };
  const old = (await routinesReport()) ?? { at: Date.now(), routines: [] };
  const i = old.routines.findIndex((r) => r.id === id);
  if (i >= 0) old.routines[i] = { ...old.routines[i], lastRun: run, ...(name ? { name } : {}) };
  else old.routines.push({ id, name: name ?? id, enabled: true, cron: str(o.cron, 120), lastRun: run });
  await setJSON(KEY, old);
  return run;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (h: number, m: number) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;

/** "Weekdays 5:30 AM PT", "Every hour 6 AM–5 PM, weekdays", or the raw cron when it's unusual. */
export function describeCron(cron?: string): string {
  if (!cron) return 'Runs when started';
  const tz = cron.match(/^CRON_TZ=(\S+)\s+/);
  const zone = tz ? (tz[1] === 'America/Los_Angeles' ? 'PT' : tz[1].split('/').pop()!.replace('_', ' ')) : 'UTC';
  const [min, hour, dom, mon, dow] = cron.replace(/^CRON_TZ=\S+\s+/, '').trim().split(/\s+/);
  if (!min || !hour || dom !== '*' || mon !== '*') return cron;
  const days = dow === '*' ? 'Every day' : dow === '1-5' ? 'Weekdays' : /^\d$/.test(dow) ? `${DAYS[Number(dow)]}s` : /^\d-\d$/.test(dow) ? `${DAYS[Number(dow[0])]}–${DAYS[Number(dow[2])]}` : `Days ${dow}`;
  const m = Number(min);
  if (!/^\d+$/.test(min)) return cron;
  if (/^\d+$/.test(hour)) return `${days} ${hm(Number(hour), m)} ${zone}`;
  const range = hour.match(/^(\d+)-(\d+)$/);
  if (range) return `${days}, hourly at :${String(m).padStart(2, '0')} from ${hm(Number(range[1]), m)} to ${hm(Number(range[2]), m)} ${zone}`;
  if (hour === '*') return `${days}, every hour at :${String(m).padStart(2, '0')}`;
  return cron;
}
