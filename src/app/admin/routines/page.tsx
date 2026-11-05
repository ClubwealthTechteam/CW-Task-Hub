// Admin settings → Routines: every Club Wealth Claude routine with its schedule, last run, next run and
// whether it failed, from the hourly "Routines status → hub" report (src/lib/routines/status.ts).

import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { describeCron, routinesReport, type RoutineStatus } from '@/lib/routines/status';
import { nextRun, prevRun } from '@/lib/routines/cron';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Routines · Admin settings · CW AI Task Hub' };

const TZ = 'America/Los_Angeles';
const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

type Tone = 'ok' | 'bad' | 'warn' | 'off' | 'run';
const runAt = (r: RoutineStatus) => Date.parse(r.lastRun?.finishedAt ?? r.lastRun?.firedAt ?? '') || 0;

/** When it should run next: from its schedule (so it's right even between reports). */
function nextOf(r: RoutineStatus, now: number): number | null {
  if (!r.enabled) return null;
  if (r.cron) return nextRun(r.cron, now);
  const t = r.nextRunAt ? Date.parse(r.nextRunAt) : NaN;
  return Number.isFinite(t) && t > now ? t : null;
}

function runState(r: RoutineStatus, now: number): { tone: Tone; label: string } {
  const s = (r.lastRun?.status ?? '').replace('ROUTINE_RUN_STATUS_', '');
  if (!r.enabled) return { tone: 'off', label: r.runOnceAt ? 'Done (one-time)' : 'Paused' };
  if (s === 'FAILED' || s === 'ERRORED' || s === 'TIMED_OUT') return { tone: 'bad', label: 'Last run failed' };
  if (s === 'RUNNING' || s === 'IN_PROGRESS' || s === 'PENDING') return { tone: 'run', label: 'Running now' };
  // A scheduled run that should have finished (45 min grace) but hasn't reported back.
  const due = r.cron ? prevRun(r.cron, now - 45 * 60000) : null;
  if (due && runAt(r) < due) return { tone: 'warn', label: `Late: no report for ${when(new Date(due).toISOString())}` };
  if (!s) return { tone: 'warn', label: 'Hasn’t run yet' };
  return { tone: 'ok', label: 'OK' };
}

export default async function RoutinesPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  const report = await routinesReport();
  const now = Date.now();
  const rows = (report?.routines ?? []).map((r) => ({ r, s: runState(r, now) }));
  const order: Record<Tone, number> = { bad: 0, warn: 1, run: 2, ok: 3, off: 4 };
  rows.sort((a, b) => order[a.s.tone] - order[b.s.tone] || a.r.name.localeCompare(b.r.name));
  const count = (t: Tone) => rows.filter((x) => x.s.tone === t).length;

  return (
    <>
      <Header user={user} current="settings" />
      <main className="page adm">
        <AdminTabs current="routines">
          <div className="adm-status" role="group" aria-label="Routines status">
            <div className="adm-ver">
              <span className="adm-sub">Claude routines</span>
              <b>{rows.filter((x) => x.r.enabled).length} on</b>
              <span className="adm-sub">{report ? `List updated ${ago(now - report.at)}` : 'No report yet'}</span>
            </div>
            <ul>
              <li><i className={count('bad') ? 'off' : 'ok'} aria-hidden="true" /><span><b>Failed</b><small>{count('bad') || 'None'}</small></span></li>
              <li><i className={count('warn') ? 'off' : 'ok'} aria-hidden="true" /><span><b>Late or not run yet</b><small>{count('warn') || 'None'}</small></span></li>
              <li><i className="ok" aria-hidden="true" /><span><b>How it updates</b><small>Each routine reports when it finishes</small></span></li>
            </ul>
          </div>
        </AdminTabs>

        <section className="rt" aria-labelledby="rt-title">
          <div className="rt-h">
            <h2 id="rt-title">Every routine</h2>
            <p className="muted small">Times are Pacific. Each routine reports here when it finishes, with a one-line result. “Late” means a scheduled run hasn’t reported back within 45 minutes.</p>
          </div>
          {!rows.length ? (
            <p className="muted">No routines reported yet.</p>
          ) : (
            <div className="rt-wrap">
              <table className="rt-table">
                <thead>
                  <tr><th>Routine</th><th>Schedule</th><th>Last run</th><th>Next run</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ r, s }) => (
                    <tr key={r.id} className={`t-${s.tone}`}>
                      <td><b>{r.name}</b><small>{r.id}</small></td>
                      <td>{r.runOnceAt ? `Once, ${when(r.runOnceAt)}` : describeCron(r.cron)}</td>
                      <td>{r.lastRun?.firedAt ? <>{when(r.lastRun.finishedAt ?? r.lastRun.firedAt)}{r.lastRun.summary && <small className="rt-sum">{r.lastRun.summary}</small>}{r.lastRun.failureReason && !/UNSPECIFIED/.test(r.lastRun.failureReason) && <small>{r.lastRun.failureReason.replace('ROUTINE_RUN_FAILURE_REASON_', '').toLowerCase().replace(/_/g, ' ')}</small>}</> : <span className="muted">Never</span>}</td>
                      <td>{(() => { const n = nextOf(r, now); return n ? when(new Date(n).toISOString()) : <span className="muted">—</span>; })()}</td>
                      <td><span className={`rt-pill t-${s.tone}`}>{s.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
