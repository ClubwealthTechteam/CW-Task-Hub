// Status of the Club Wealth Claude routines (scheduled tasks on claude.ai), shown on Admin settings →
// Routines. The hub can't list routines itself, so a small "Routines status → hub" routine reads them
// every 2 hours on weekdays and posts them to /api/routines/report (ROUTINES_REPORT_SECRET). Stored in the hub store.

import { getJSON, setJSON } from '@/lib/store';

export interface RoutineRun { status: string; firedAt?: string; finishedAt?: string; sessionId?: string; failureReason?: string }
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

export async function saveReport(routines: RoutineStatus[]) {
  const report: RoutinesReport = { at: Date.now(), routines };
  await setJSON(KEY, report);
  return report;
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
