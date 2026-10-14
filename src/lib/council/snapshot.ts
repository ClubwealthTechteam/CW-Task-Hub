// What the council reads on each run: a read-only picture of the hub. Integration checks (reads only),
// recent errors, the assistant's track record, recent AI conversations (for compliance), samples to
// fact-check against Keap, and an inventory of the hub's own data. Secrets are never included: only
// whether each setting is present.

import { PEOPLE, personById } from '@/config/people';
import { allAutomations } from '@/data/catalog';
import { getJSON, scanKeys, storeIsPersistent } from '@/lib/store';
import { callKeap, keapConfigured } from '@/lib/integrations/keap/client';
import { eventbriteConfigured, organizationId } from '@/lib/integrations/eventbrite/client';
import { sheetsConfigured, sheetsKeyState } from '@/lib/integrations/google/sheets';
import { inboxConfigured, listFeed } from '@/lib/integrations/zapier-feed';
import { chatIsConfigured } from '@/lib/chat/routine';
import { canvaConfigured } from '@/lib/canva/client';
import type { Conversation } from '@/lib/chat/store';
import { FILE_DAYS } from '@/lib/chat/files';
import { listPosts } from '@/lib/calendar';
import { listRecords, getSettings } from '@/lib/welcome/store';
import { newClients } from '@/lib/welcome/keap-clients';
import { getFinding } from '@/lib/welcome/finder';
import { listBatches, listOpps } from '@/lib/referrals/store';
import { cachedMembers } from '@/lib/referrals/members';

const DAY = 86_400_000;
const ENV_NAMES = [
  'SESSION_SECRET', 'HUB_ACCESS_CODES', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'CLAUDE_CHAT_ROUTINE_TOKEN', 'CLAUDE_COUNCIL_ROUTINE_TOKEN',
  'KEAP_API_KEY', 'EVENTBRITE_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'ZAPIER_INBOUND_SECRET', 'ZAPIER_HOOKS',
  'CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CRON_SECRET', 'FORM_RESPONSES_SHEET_ID', 'CHAT_DAILY_LIMIT',
];

async function timed<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try { await fn(); return { ok: true, ms: Date.now() - t }; } catch (e) { return { ok: false, ms: Date.now() - t, error: String((e as Error).message).slice(0, 200) }; }
}
const cut = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? '');
const who = (id: string) => { const p = personById(id); return p ? `${p.name} (${p.departments.join(', ')})` : id; };

async function conversations(): Promise<Conversation[]> {
  const keys = await scanKeys('chat:conv:*', 3000);
  const convs = await Promise.all(keys.map((k) => getJSON<Conversation | null>(k.key, null)));
  return convs.filter(Boolean) as Conversation[];
}

export async function buildSnapshot() {
  const now = Date.now();
  const [convs, keys, tasks] = await Promise.all([conversations(), scanKeys('*', 8000), allAutomations()]);
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));

  // ---- integrations (each check only reads) ----
  const integrations = {
    storage: { configured: storeIsPersistent(), keys: keys.length },
    assistant: { configured: chatIsConfigured() },
    keap: { configured: keapConfigured(), check: keapConfigured() ? await timed(() => callKeap('account.profile')) : null },
    eventbrite: { configured: eventbriteConfigured(), check: eventbriteConfigured() ? await timed(() => organizationId()) : null },
    googleSheets: { configured: sheetsConfigured(), key: sheetsKeyState() },
    zapier: { inbox: inboxConfigured(), lastUpdate: (await listFeed())[0]?.at ?? null },
    canva: { configured: canvaConfigured() },
  };

  // ---- the assistant's last 7 days ----
  const week = convs.flatMap((c) => c.messages.filter((m) => m.at > now - 7 * DAY).map((m) => ({ c, m })));
  const replies = week.filter((x) => x.m.role === 'assistant');
  const assistant = {
    questions: week.filter((x) => x.m.role === 'user' && !x.c.background).length,
    replies: replies.filter((x) => x.m.status === 'done').length,
    failed: replies.filter((x) => x.m.status === 'error').length,
    waiting: replies.filter((x) => x.m.status === 'pending').length,
    backgroundJobs: replies.filter((x) => x.c.background).length,
    recentFailures: replies.filter((x) => x.m.status === 'error').slice(-12).map((x) => ({ at: x.m.at, who: who(x.c.owner), task: x.c.automationId ? taskTitle.get(x.c.automationId) : x.c.background ? 'background job' : 'CW Assistant bubble', error: cut(x.m.text, 200) })),
  };

  // ---- other errors the hub recorded ----
  const [batches, finding, records, opps, posts, members, settings] = await Promise.all([listBatches(), getFinding(), listRecords(), listOpps(), listPosts('social-media'), cachedMembers(), getSettings()]);
  const errors = [
    ...batches.filter((b) => b.status === 'error').slice(0, 10).map((b) => ({ where: 'Referral finder', at: b.at, error: cut(b.error, 200) })),
    ...(finding?.status === 'error' ? [{ where: 'New client finder', at: finding.at, error: cut(finding.error, 200) }] : []),
    ...Object.values(records).filter((r) => r.graphic?.status === 'error').slice(0, 10).map((r) => ({ where: 'Welcome graphic', at: r.graphic!.at, error: `contact ${r.contactId}` })),
  ];

  // ---- recent AI conversations (for the Compliance Guard), newest first ----
  const recentChats = convs.filter((c) => !c.background && c.updated > now - 3 * DAY)
    .flatMap((c) => c.messages.filter((m) => m.role === 'user' && m.at > now - 3 * DAY).map((m) => {
      const i = c.messages.indexOf(m);
      const reply = c.messages[i + 1];
      return { conversationId: c.id, at: m.at, who: who(c.owner), task: c.automationId ? taskTitle.get(c.automationId) ?? c.automationId : 'CW Assistant bubble', asked: cut(m.text, 600), files: m.files?.map((f) => f.name), answered: cut(reply?.text, 400) };
    })).sort((a, b) => b.at - a.at).slice(0, 80);

  // ---- samples to fact-check against Keap ----
  const welcomeClients = keapConfigured() ? await newClients(settings).catch(() => []) : [];
  const accuracy = {
    welcomePosts: welcomeClients.slice(0, 15).map((c) => {
      const r = records[c.contactId];
      return { contactId: c.contactId, keap: { name: `${c.first} ${c.last}`, business: c.business, city: c.city, coach: c.coach, email: c.email }, hubOverrides: { business: r?.business, city: r?.city, coach: r?.coach }, whyClaudePicked: c.why, pageCaption: cut(r?.pageCaption, 400), groupCaption: cut(r?.groupCaption, 400) };
    }),
    referrals: opps.slice(0, 15).map((o) => {
      const m = members.find((x) => x.id === o.memberId);
      return { need: o.need, where: [o.city, o.state].filter(Boolean).join(', '), member: m ? { id: m.id, name: m.name, business: m.business, city: m.city, state: m.state, phone: m.phone ? 'on file' : 'missing' } : null, sms: cut(o.sms, 300), status: o.status };
    }),
    assistantReplies: convs.filter((c) => !c.background).flatMap((c) => c.messages.filter((m) => m.role === 'assistant' && m.status === 'done' && m.at > now - 3 * DAY && /@|\$\d|Keap|client/i.test(m.text)).map((m) => ({ conversationId: c.id, who: who(c.owner), task: c.automationId ? taskTitle.get(c.automationId) : undefined, reply: cut(m.text, 700) }))).slice(0, 15),
  };

  // ---- the hub's own data (for the Database Secretary) ----
  const groups = new Map<string, { count: number; bytes: number }>();
  for (const k of keys) {
    const g = k.key.split(':').slice(0, 2).join(':').replace(/:(c|f|run|b|o)_[a-z0-9]+.*$/, '');
    const cur = groups.get(g) ?? { count: 0, bytes: 0 };
    groups.set(g, { count: cur.count + 1, bytes: cur.bytes + k.bytes });
  }
  const dupKey = (p: { title: string; date: string; time?: string }) => `${p.title.toLowerCase()}|${p.date}|${p.time ?? ''}`;
  const seen = new Set<string>();
  let calendarDuplicates = 0;
  for (const p of posts) { const k = dupKey(p); if (seen.has(k)) calendarDuplicates++; seen.add(k); }
  const data = {
    totalKeys: keys.length,
    totalBytes: keys.reduce((n, k) => n + k.bytes, 0),
    byArea: [...groups.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.bytes - a.bytes).slice(0, 40),
    conversations: { total: convs.length, background: convs.filter((c) => c.background).length, backgroundOlderThan30Days: convs.filter((c) => c.background && c.updated < now - 30 * DAY).length },
    calendar: { posts: posts.length, exactDuplicates: calendarDuplicates, draftsInThePast: posts.filter((p) => p.repeat === 'none' && p.status !== 'posted' && p.date < new Date(now - DAY).toISOString().slice(0, 10)).length },
    welcome: { records: Object.keys(records).length, byStatus: Object.values(records).reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {}) },
    referrals: { opportunities: opps.length, byStatus: opps.reduce<Record<string, number>>((a, o) => ({ ...a, [o.status]: (a[o.status] ?? 0) + 1 }), {}), closedOlderThan60Days: opps.filter((o) => o.status === 'closed' && (o.updated ?? o.at) < now - 60 * DAY).length, failedBatchesOlderThan7Days: batches.filter((b) => b.status === 'error' && b.at < now - 7 * DAY).length, members: members.length },
    // Chat files are stored with an expiry, so the store cleans them up on its own.
    files: { count: keys.filter((k) => /^chat:file:f_[a-z0-9]+$/.test(k.key)).length, bytes: keys.filter((k) => k.key.startsWith('chat:file:')).reduce((n, k) => n + k.bytes, 0), deletedAutomaticallyAfterDays: FILE_DAYS },
    // What already checks the code, so a reviewer that can't run builds itself knows it is covered.
    codeChecks: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, ci: 'Every push to main runs the type check, a production build, a security audit of the packages and browser smoke tests in GitHub Actions (CI). Vercel only goes live with builds that succeed.' },
  };

  return {
    hub: 'https://cw-ai-task-hub.vercel.app',
    takenAt: new Date(now).toISOString(),
    deployment: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, message: cut(process.env.VERCEL_GIT_COMMIT_MESSAGE, 120) || null, env: process.env.VERCEL_ENV ?? null },
    settingsPresent: Object.fromEntries(ENV_NAMES.map((n) => [n, Boolean(process.env[n])])),
    people: PEOPLE.map((p) => ({ id: p.id, name: p.name, role: p.role, departments: p.departments })),
    integrations, assistant, errors, recentChats, accuracy, data,
  };
}
