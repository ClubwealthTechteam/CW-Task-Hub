// The "hand-off for Claude Code": the council's hot and needs-attention findings as one fix list to paste
// into a Claude Code session. Shared by the Council page (Copy) and the Executive Judge's briefing.

import { AGENTS, type Finding, type Report } from './agents';

/** 🔥 Hot = critical or high. ⚠ Needs attention = medium, or anything from an agent marked warn/fail. */
export function tagOf(f: Finding, agentStatus: string): 'hot' | 'attention' | null {
  if (f.severity === 'critical' || f.severity === 'high') return 'hot';
  if (f.severity === 'medium' || (agentStatus !== 'ok' && f.severity !== 'info')) return 'attention';
  return null;
}

export function handoffItems(report: Report) {
  return report.agents.flatMap((a) => a.findings.map((f) => ({ agent: AGENTS.find((x) => x.id === a.id)!.name, f, tag: tagOf(f, a.status) })))
    .filter((x) => x.tag) as { agent: string; f: Finding; tag: 'hot' | 'attention' }[];
}

export function buildHandoff(report: Report): string {
  const items = handoffItems(report);
  const date = new Date(report.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
  const line = (x: (typeof items)[number], i: number) => [
    `${i + 1}. [${x.f.severity.toUpperCase()}] ${x.f.title}${x.f.area ? ` (${x.f.area})` : ''} — found by ${x.agent}`,
    x.f.detail && `   What: ${x.f.detail}`,
    x.f.evidence && `   Evidence: ${x.f.evidence}`,
    x.f.recommendation && `   Suggested fix: ${x.f.recommendation}`,
  ].filter(Boolean).join('\n');
  const hot = items.filter((x) => x.tag === 'hot');
  const attention = items.filter((x) => x.tag === 'attention');
  return [
    `CW Hub Council hand-off — fix list (${date} Pacific)`,
    `Council verdict: ${report.headline}`,
    '',
    'Context for Claude Code: this is the CW AI Task Hub (repo ClubwealthTechteam/CW-Task-Hub, Next.js on Vercel, https://cw-admin-hub.vercel.app). Keap and every other integration stay read-only. Please confirm each item against the code before changing anything, fix the hot items first, and tell me what you changed.',
    '',
    `🔥 HOT (${hot.length})`,
    hot.length ? hot.map(line).join('\n\n') : 'None.',
    '',
    `⚠ NEEDS ATTENTION (${attention.length})`,
    attention.length ? attention.map((x, i) => line(x, i)).join('\n\n') : 'None.',
    ...(report.proposals.some((p) => p.status === 'open') ? ['', 'Open clean-up proposals (applied from the Council page, not by code): ' + report.proposals.filter((p) => p.status === 'open').map((p) => p.action).join(', ')] : []),
  ].join('\n');
}
