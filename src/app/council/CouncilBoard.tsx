'use client';

// Council page body: one card per agent with its status and findings, the Secretary's clean-up proposals
// (Apply / Dismiss), run history, and "Run the council now".

import { useCallback, useEffect, useState } from 'react';
import { ACTIONS, AGENTS, type Level, type Proposal, type Report, type Run, type Severity } from '@/lib/council/agents';

const LEVEL: Record<Level, string> = { ok: 'All good', warn: 'Needs attention', fail: 'Problem' };
const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function CouncilBoard({ readOnly }: { readOnly?: boolean }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [configured, setConfigured] = useState(true);
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/council', { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (res.ok) { setReports(b.reports); setRuns(b.runs); setConfigured(b.configured); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const running = runs.some((r) => r.status === 'running');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [running, load]);

  async function runNow() {
    setBusy(true); setError('');
    const res = await fetch('/api/council/run', { method: 'POST' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) setError(b.error || b.run?.error || 'Couldn’t start the council');
    setBusy(false);
    load();
  }
  async function decide(p: Proposal, decision: 'apply' | 'dismiss') {
    const res = await fetch('/api/council/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, decision }) });
    const b = await res.json().catch(() => ({}));
    if (res.ok) setReports((rs) => rs.map((r) => ({ ...r, proposals: r.proposals.map((x) => (x.id === p.id ? b.proposal : x)) })));
  }

  const report = reports[pick];
  const lastRun = runs[0];

  return (
    <>
      <section className="card council-bar">
        <div>
          {report ? <><span className={`lvl lvl-${report.overall}`}>{LEVEL[report.overall]}</span> <b>{report.headline}</b><span className="muted small"> · {when(report.at)}</span></>
            : <b>No council report yet.</b>}
          {running && <p className="small muted" style={{ margin: '4px 0 0' }}><span className="cf-spin" aria-hidden="true" /> The council is meeting now. Reports usually take 5–15 minutes.</p>}
          {lastRun?.status === 'error' && !running && <p className="small wp-warn" style={{ margin: '4px 0 0' }}>Last run didn’t finish: {lastRun.error}</p>}
          {!configured && <p className="small wp-warn" style={{ margin: '4px 0 0' }}>The council isn’t switched on yet: add CLAUDE_COUNCIL_ROUTINE_TOKEN in Vercel (see docs/council-setup.md).</p>}
          {error && <p className="small wp-warn" style={{ margin: '4px 0 0' }}>{error}</p>}
        </div>
        <div className="row">
          {reports.length > 1 && (
            <select value={pick} onChange={(e) => setPick(Number(e.target.value))} aria-label="Report">
              {reports.map((r, i) => <option key={r.runId} value={i}>{i === 0 ? 'Latest' : when(r.at)} · {LEVEL[r.overall]}</option>)}
            </select>
          )}
          {!readOnly && <button className="btn primary" disabled={busy || running || !configured} onClick={runNow}>{running ? 'Council is meeting…' : busy ? 'Starting…' : 'Run the council now'}</button>}
        </div>
      </section>

      <section className="council-grid">
        {AGENTS.map((a) => {
          const r = report?.agents.find((x) => x.id === a.id);
          const findings = [...(r?.findings ?? [])].sort((x, y) => SEV_ORDER.indexOf(x.severity) - SEV_ORDER.indexOf(y.severity));
          return (
            <article key={a.id} className={`card agent lvl-b-${r?.status ?? 'none'}`}>
              <div className="agent-h">
                <span className="agent-ic" aria-hidden="true">{a.icon}</span>
                <div><h2>{a.name}</h2><p className="muted small">{a.job}</p></div>
                {r && <span className={`lvl lvl-${r.status}`}>{LEVEL[r.status]}</span>}
              </div>
              <p className="agent-sum">{r?.summary ?? 'Waiting for the first council run.'}</p>
              {findings.length > 0 && (
                <ul className="agent-findings">
                  {findings.map((f, i) => {
                    const key = `${a.id}-${i}`;
                    return (
                      <li key={key} className={`sev-${f.severity}`}>
                        <button onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
                          <span className={`sev sev-b-${f.severity}`}>{f.severity}</span>
                          <span className="f-title">{f.title}</span>
                          {f.area && <span className="muted small">{f.area}</span>}
                        </button>
                        {open === key && (
                          <div className="f-body">
                            {f.detail && <p>{f.detail}</p>}
                            {f.evidence && <p className="f-ev"><b>Evidence:</b> {f.evidence}</p>}
                            {f.recommendation && <p className="f-rec"><b>{a.id === 'strategist' ? 'Plan B:' : 'What to do:'}</b> {f.recommendation}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      {report && report.proposals.length > 0 && (
        <section className="card">
          <h2>Clean-ups proposed by the Database Secretary</h2>
          <p className="muted small" style={{ margin: 0 }}>These only touch the hub’s own data, never Keap. Nothing happens until you press Apply.</p>
          <ul className="proposals">
            {report.proposals.map((p) => (
              <li key={p.id}>
                <div><b>{ACTIONS[p.action]}</b><span className="muted small">{p.why}</span>{p.result && <span className="small">✓ {p.result}</span>}</div>
                {p.status === 'open' && !readOnly ? (
                  <span className="row"><button className="btn primary" onClick={() => decide(p, 'apply')}>Apply</button><button className="btn" onClick={() => decide(p, 'dismiss')}>Dismiss</button></span>
                ) : <span className="muted small">{p.status === 'applied' ? 'Applied' : p.status === 'dismissed' ? 'Dismissed' : 'Open'}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {runs.length > 0 && (
        <section className="card">
          <h2>Recent runs</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Started</th><th>By</th><th>Status</th><th>Finished</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}><td>{when(r.at)}</td><td>{r.by === 'schedule' ? 'Daily schedule' : r.by}</td><td>{r.status === 'done' ? 'Reported' : r.status === 'running' ? 'Meeting…' : `Failed${r.error ? `: ${r.error}` : ''}`}</td><td>{r.finishedAt ? when(r.finishedAt) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
