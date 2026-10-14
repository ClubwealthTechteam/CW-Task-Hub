// Data for the home dashboard (super admins): assistant activity, recent work, what needs attention,
// integrations and who still owes a process form. Read-only. Cached for 5 minutes so the page stays fast.

import { PEOPLE, personById } from '@/config/people';
import { departmentById } from '@/config/departments';
import { cached } from '@/lib/store';
import { getConversation, listConversations } from '@/lib/chat/store';
import { getSubmissions } from '@/lib/forms/submissions';
import { listReports } from '@/lib/council/store';
import { handoffItems } from '@/lib/council/handoff';
import { chatIsConfigured } from '@/lib/chat/routine';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { sheetsConfigured, sheetsKeyState } from '@/lib/integrations/google/sheets';
import { inboxConfigured } from '@/lib/integrations/zapier-feed';
import { canvaConfigured } from '@/lib/canva/client';
import type { Automation } from '@/data/automations';
import { adoptionData, type PersonUse } from '@/lib/adoption';
import { recentErrors } from '@/lib/errors';

const DAY = 86_400_000;
const pacific = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export interface DayCount { date: string; questions: number; people: number }
export interface ActivityRow { id: string; at: number; person: string; dept: string; task: string; messages: number; status: 'done' | 'waiting' | 'failed' }

async function activity(taskTitle: Map<string, string>) {
  const now = Date.now();
  const since = now - 28 * DAY;
  const indexes = await Promise.all(PEOPLE.map(async (p) => ({ p, list: await listConversations(p.id) })));
  const recent = indexes.flatMap(({ p, list }) => list.filter((c) => !c.judge && c.updated > since).map((c) => ({ p, c })))
    .sort((a, b) => b.c.updated - a.c.updated).slice(0, 150);
  const convs = (await Promise.all(recent.map((r) => getConversation(r.c.id)))).filter(Boolean);

  const byDay = new Map<string, { q: number; who: Set<string> }>();
  for (let t = since + DAY; t <= now; t += DAY) byDay.set(pacific(t), { q: 0, who: new Set() });
  const rows: ActivityRow[] = [];
  const use: Record<string, PersonUse> = {};
  for (const c of convs) {
    if (!c || c.background || c.judge) continue;
    const u = (use[c.owner] ??= { messageDays: [], messages7: 0, messagesPrev7: 0, tasks: [], lastMessage: 0 });
    for (const m of c.messages) if (m.role === 'user' && m.at > since) {
      const day = pacific(m.at);
      const d = byDay.get(day); if (d) { d.q++; d.who.add(c.owner); }
      if (!u.messageDays.includes(day)) u.messageDays.push(day);
      if (m.at > now - 7 * DAY) u.messages7++; else if (m.at > now - 14 * DAY) u.messagesPrev7++;
      u.lastMessage = Math.max(u.lastMessage, m.at);
    }
    if (c.automationId && !u.tasks.includes(c.automationId) && c.messages.some((m) => m.role === 'user' && m.at > since)) u.tasks.push(c.automationId);
    const p = personById(c.owner);
    const last = [...c.messages].reverse().find((m) => m.role === 'assistant');
    rows.push({
      id: c.id, at: c.updated, person: p?.name ?? c.owner, dept: departmentById(p?.departments[0] ?? '')?.name ?? '',
      task: c.automationId ? taskTitle.get(c.automationId) ?? 'Task assistant' : 'CW Assistant',
      messages: c.messages.filter((m) => m.role === 'user').length,
      status: last?.status === 'error' ? 'failed' : last?.status === 'pending' ? 'waiting' : 'done',
    });
  }
  const days: DayCount[] = [...byDay.entries()].map(([date, v]) => ({ date, questions: v.q, people: v.who.size }));
  return { days, rows: rows.sort((a, b) => b.at - a.at).slice(0, 40), use };
}

export async function dashboardData(all: Automation[]) {
  const taskTitle = new Map(all.map((a) => [a.id, a.title]));
  const act = await cached('dashboard:activity', 5 * 60, () => activity(taskTitle));
  const [subs, reports, adoption, errors] = await Promise.all([getSubmissions(), listReports(), adoptionData(act.use ?? {}, all.length), recentErrors(24)]);

  const thisWeek = act.days.slice(-7).reduce((n, d) => n + d.questions, 0);
  const lastWeek = act.days.slice(-14, -7).reduce((n, d) => n + d.questions, 0);

  const report = reports[0];
  const items = report ? handoffItems(report) : [];
  const submitted = new Set(subs.map((s) => s.personId).filter(Boolean));
  const owesForm = PEOPLE.filter((p) => p.id !== 'miguel' && !submitted.has(p.id));

  const integrations = [
    { name: 'CW Assistant', ok: chatIsConfigured() },
    { name: 'Keap', ok: keapConfigured(), note: 'read-only' },
    { name: 'Eventbrite', ok: eventbriteConfigured() },
    { name: 'Google Sheets', ok: sheetsConfigured() && sheetsKeyState() === 'ok' },
    { name: 'Zapier', ok: inboxConfigured() },
    { name: 'Canva', ok: canvaConfigured(), note: canvaConfigured() ? undefined : 'not set up' },
  ];

  return {
    days: act.days, rows: act.rows, thisWeek, lastWeek,
    council: report ? { at: report.at, overall: report.overall, headline: report.headline, hot: items.filter((i) => i.tag === 'hot').length, attention: items.filter((i) => i.tag === 'attention').length, top: items.slice(0, 3).map((i) => ({ tag: i.tag, title: i.f.title })) } : null,
    forms: { submitted: PEOPLE.filter((p) => submitted.has(p.id)).map((p) => p.name), waiting: owesForm.map((p) => p.name), total: submitted.size + owesForm.length },
    integrations,
    adoption,
    errors: { count: errors.count, items: errors.items.slice(0, 4) },
  };
}
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
