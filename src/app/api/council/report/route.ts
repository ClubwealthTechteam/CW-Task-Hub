// The council posts its report here (with the run's token). Shape is checked and trimmed before saving.

import { NextResponse } from 'next/server';
import { listReports, listRuns, saveReports, saveRuns, validRun } from '@/lib/council/store';
import { ACTIONS, AGENTS, type ActionId, type AgentReport, type Finding, type Level, type Report, type Severity } from '@/lib/council/agents';

export const dynamic = 'force-dynamic';

const LEVELS: Level[] = ['ok', 'warn', 'fail'];
const SEV: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const runId = q.get('run') ?? '';
  if (!(await validRun(runId, q.get('token') ?? ''))) return NextResponse.json({ ok: false, error: 'Invalid or expired run token' }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 400_000) return NextResponse.json({ ok: false, error: 'Report too large' }, { status: 413 });
  let body: Row;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'Send JSON' }, { status: 400 }); }

  const agents: AgentReport[] = AGENTS.map((a) => {
    const r: Row = (Array.isArray(body.agents) ? body.agents : []).find((x: Row) => x?.id === a.id) ?? {};
    const findings: Finding[] = (Array.isArray(r.findings) ? r.findings : []).slice(0, 25).map((f: Row) => ({
      severity: SEV.includes(f.severity) ? f.severity : 'info', title: str(f.title, 160) || 'Finding', detail: str(f.detail, 1500),
      evidence: str(f.evidence, 800) || undefined, recommendation: str(f.recommendation, 1500) || undefined, area: str(f.area, 60) || undefined,
    }));
    return { id: a.id, status: LEVELS.includes(r.status) ? r.status : 'warn', summary: str(r.summary, 600) || 'No report.', findings };
  });
  const proposals = (Array.isArray(body.proposals) ? body.proposals : []).filter((p: Row) => p?.action in ACTIONS).slice(0, 6)
    .map((p: Row, i: number) => ({ id: `${runId}-p${i}`, action: p.action as ActionId, why: str(p.why, 400), status: 'open' as const }));
  const overall: Level = agents.some((a) => a.status === 'fail') ? 'fail' : agents.some((a) => a.status === 'warn') ? 'warn' : 'ok';
  const report: Report = { runId, at: Date.now(), overall, headline: str(body.headline, 300) || 'Council report', agents, proposals };

  await saveReports([report, ...(await listReports()).filter((r) => r.runId !== runId)]);
  const runs = await listRuns();
  const run = runs.find((r) => r.id === runId);
  if (run) { run.status = 'done'; run.finishedAt = Date.now(); await saveRuns(runs); }
  return NextResponse.json({ ok: true });
}
