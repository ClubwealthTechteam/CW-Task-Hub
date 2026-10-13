// What the Executive Judge knows: the council's latest reports. The Judge only discusses them with the super
// admins; it can't run, apply or change anything.

import { listReports, listRuns } from './store';
import { AGENTS } from './agents';
import { buildHandoff } from './handoff';

const cut = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? '');

export async function judgeContext(): Promise<string> {
  const [reports, runs] = await Promise.all([listReports(), listRuns()]);
  const latest = reports[0];
  const earlier = reports.slice(1, 4);
  return [
    '',
    '',
    'ROLE: EXECUTIVE JUDGE of the CW Hub Council. You are talking with a super admin on the Council page. You have read the council\'s reports below. Weigh them: say what truly matters, what can wait, where agents may be wrong or overreacting, and what to fix first and why. You ONLY discuss: you cannot run the council, apply clean-ups, or change anything in the hub, Keap or any system, and you never claim you did. When asked for a hand-off, summary or fix list, write it as plain text the admin can paste to Claude Code (hot items first, with evidence and suggested fixes), inside one [DRAFT] block.',
    latest ? `LATEST COUNCIL REPORT (${new Date(latest.at).toISOString()}, overall ${latest.overall}): ${latest.headline}` : 'No council report yet: the council hasn\'t run.',
    ...(latest ? latest.agents.map((a) => {
      const name = AGENTS.find((x) => x.id === a.id)?.name;
      return [`- ${name}: ${a.status}. ${cut(a.summary, 400)}`, ...a.findings.map((f) => `   • [${f.severity}] ${f.title}${f.area ? ` (${f.area})` : ''}: ${cut(f.detail, 300)}${f.evidence ? ` | evidence: ${cut(f.evidence, 200)}` : ''}${f.recommendation ? ` | fix: ${cut(f.recommendation, 300)}` : ''}`)].join('\n');
    }) : []),
    ...(latest?.proposals.length ? [`Clean-up proposals: ${latest.proposals.map((p) => `${p.action} (${p.status})`).join(', ')}`] : []),
    ...(earlier.length ? ['EARLIER REPORTS (for trends):', ...earlier.map((r) => `- ${new Date(r.at).toISOString().slice(0, 10)} · ${r.overall} · ${cut(r.headline, 200)} · ${r.agents.map((a) => `${a.id}:${a.status}`).join(', ')}`)] : []),
    `RECENT RUNS: ${runs.slice(0, 5).map((r) => `${new Date(r.at).toISOString().slice(0, 16)} ${r.status}${r.error ? ` (${cut(r.error, 80)})` : ''}`).join('; ') || 'none'}`,
    ...(latest ? ['', 'THE STANDARD HAND-OFF TEXT (what the page\'s Copy button produces; improve on it if asked):', cut(buildHandoff(latest), 6000)] : []),
  ].join('\n');
}
