// Finding the right Keap tag without hunting for it: every tag is read from Keap (read-only), ranked by how
// well its name fits ("new client", "active member"…) and by how many people got it recently, and then
// Claude looks at the best candidates and recommends one (in a background chat).

import type { Person } from '@/config/people';
import { callKeap } from './client';
import { getJSON, setJSON } from '@/lib/store';
import { buildPayload, chatIsConfigured, fireChatRoutine } from '@/lib/chat/routine';
import { createConversation, getConversation, newId, saveConversation, type ChatMessage } from '@/lib/chat/store';

export type TagPurpose = 'new-client' | 'member';
export interface KeapTag { id: number; name: string; category?: string }
export interface TagCandidate extends KeapTag { recent: number; total: number; sample: string[]; score: number }
export interface ClaudePick { status: 'thinking' | 'done' | 'error'; picks?: { id: number; why: string }[]; at: number; conversationId?: string; messageId?: string }

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const RECENT_DAYS = 30;
let tagCache: { at: number; tags: KeapTag[] } | null = null;
const statCache = new Map<number, { at: number; recent: number; total: number; sample: string[] }>();

/** Every tag in Keap (cached 10 minutes). */
export async function allTags(): Promise<KeapTag[]> {
  if (tagCache && Date.now() - tagCache.at < 10 * 60 * 1000) return tagCache.tags;
  const tags: KeapTag[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const body = (await callKeap('tags.list', { limit: 1000, offset })) as Row;
    const rows: Row[] = body?.tags ?? [];
    rows.forEach((t) => tags.push({ id: Number(t.id), name: String(t.name ?? t.id), category: t.category?.name || undefined }));
    if (rows.length < 1000) break;
  }
  tagCache = { at: Date.now(), tags };
  return tags;
}

/** Tags whose name or category contains every word of `q`. */
export async function searchTags(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return (await allTags()).filter((t) => words.every((w) => `${t.name} ${t.category ?? ''}`.toLowerCase().includes(w))).slice(0, 60);
}

const KEYWORDS: Record<TagPurpose, { good: [RegExp, number][]; bad: RegExp }> = {
  'new-client': {
    good: [[/new\s*-?\s*(client|member|customer|student)/i, 10], [/(client|member|customer)\s*-?\s*new/i, 10], [/onboard|welcome|enrol+ed|signed\s*up|sign-?up|purchas|paid|bought|joined/i, 5], [/client|member|customer|coaching/i, 3]],
    bad: /lead|prospect|unsub|bounce|cancel|refund|former|past|inactive|declin|lost|no\s*show|webinar|optin|opt-in|nurture|test/i,
  },
  member: {
    good: [[/active\s*-?\s*(client|member|customer)/i, 10], [/(client|member|customer)\s*-?\s*active/i, 10], [/current\s*(client|member)|enrol+ed|paid/i, 5], [/client|member|customer|coaching/i, 3]],
    bad: /lead|prospect|unsub|bounce|cancel|refund|former|past|inactive|declin|lost|no\s*show|webinar|optin|opt-in|nurture|test|new\s*client\s*-?\s*welcome/i,
  },
};

function nameScore(t: KeapTag, purpose: TagPurpose) {
  const text = `${t.name} ${t.category ?? ''}`;
  let s = 0;
  for (const [re, w] of KEYWORDS[purpose].good) if (re.test(text)) s += w;
  if (KEYWORDS[purpose].bad.test(text)) s -= 8;
  return s;
}

/** How many people got the tag in the last 30 days (and in total, roughly), with a few example names. */
async function stats(tagId: number) {
  const hit = statCache.get(tagId);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit;
  const since = Date.now() - RECENT_DAYS * 86_400_000;
  let recent = 0;
  let total = 0;
  const sample: string[] = [];
  for (let offset = 0; offset < 3000; offset += 1000) {
    const body = (await callKeap('tags.contacts', { tagId, limit: 1000, offset })) as Row;
    const rows: Row[] = body?.contacts ?? [];
    total += rows.length;
    for (const r of rows) {
      if (Date.parse(r.date_applied ?? '') >= since) {
        recent++;
        if (sample.length < 3) sample.push([r.contact?.first_name, r.contact?.last_name?.[0] && `${r.contact.last_name[0]}.`].filter(Boolean).join(' '));
      }
    }
    if (rows.length < 1000) break;
  }
  const s = { at: Date.now(), recent, total, sample };
  statCache.set(tagId, s);
  return s;
}

/** The likeliest tags for a purpose, best first. */
export async function candidates(purpose: TagPurpose): Promise<TagCandidate[]> {
  const scored = (await allTags()).map((t) => ({ ...t, score: nameScore(t, purpose) })).filter((t) => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  const withStats: TagCandidate[] = [];
  for (let i = 0; i < scored.length; i += 4) {
    const got = await Promise.all(scored.slice(i, i + 4).map(async (t) => ({ ...t, ...(await stats(t.id).catch(() => ({ recent: 0, total: 0, sample: [] }))) })));
    withStats.push(...got.map(({ at: _at, ...t }: TagCandidate & { at?: number }) => t)); // eslint-disable-line @typescript-eslint/no-unused-vars
  }
  // A tag nobody has had recently is unlikely to be the live "new client" tag.
  return withStats.map((t) => ({ ...t, score: t.score + (purpose === 'new-client' ? Math.min(t.recent, 20) / 2 : Math.min(t.total, 200) / 40) }))
    .sort((a, b) => b.score - a.score);
}

// ---- Claude's pick ----
const pickKey = (purpose: TagPurpose) => `keap:tag-pick:${purpose}`;
const GOAL: Record<TagPurpose, string> = {
  'new-client': 'the tag Club Wealth applies when someone BECOMES A NEW CLIENT (just signed up / paid), used to find new clients for welcome posts',
  member: 'the tag (or tags) that mark CURRENT, ACTIVE Club Wealth members/clients, used as the directory of members who can receive referrals',
};

export async function startClaudePick(user: Person, purpose: TagPurpose, list: TagCandidate[]) {
  if (!chatIsConfigured()) return null;
  const names = (await allTags()).map((t) => t.name).slice(0, 400).join(' · ');
  const conv = createConversation(user.id, 'Keap tag suggestion', undefined);
  conv.background = true;
  const now = Date.now();
  const text = [
    'KEAP TAG PICKER: a background request from the Task Hub settings. Do NOT make graphics.',
    `Club Wealth needs ${GOAL[purpose]}.`,
    'Here are the likeliest Keap tags with real usage (people tagged in the last 30 days, total tagged, example names):',
    ...list.map((t) => `- id ${t.id} · "${t.name}"${t.category ? ` (category ${t.category})` : ''} · ${t.recent} in last 30 days · ${t.total}${t.total >= 3000 ? '+' : ''} total${t.sample.length ? ` · e.g. ${t.sample.join(', ')}` : ''}`),
    '',
    `All tag names in Keap, for context: ${names}`,
    '',
    'Pick the best tag (at most 2 if two are clearly both needed). Prefer tags whose name fits AND that are actually being applied. Reply with ONLY one ```json code block: {"picks":[{"tag_id":123,"why":"one short sentence a non-technical person understands"}]}. If none of the candidates fit, return {"picks":[]} .',
  ].join('\n');
  const asked: ChatMessage = { id: newId('m'), role: 'user', text, at: now, status: 'done' };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  await saveConversation(conv);
  const pick: ClaudePick = { status: 'thinking', at: now, conversationId: conv.id, messageId: reply.id };
  try {
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id));
  } catch {
    pick.status = 'error';
  }
  await setJSON(pickKey(purpose), pick);
  return pick;
}

/** Claude's latest pick (picking up the answer if it has arrived). */
export async function claudePick(purpose: TagPurpose, validIds: Set<number>): Promise<ClaudePick | null> {
  const pick = await getJSON<ClaudePick | null>(pickKey(purpose), null);
  if (!pick || pick.status !== 'thinking') return pick;
  const conv = await getConversation(pick.conversationId ?? '');
  const msg = conv?.messages.find((m) => m.id === pick.messageId);
  if (!msg || msg.status === 'pending') return pick;
  let next: ClaudePick = { ...pick, status: 'error' };
  if (msg.status === 'done') {
    try {
      const raw = msg.text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? msg.text.slice(msg.text.indexOf('{'), msg.text.lastIndexOf('}') + 1);
      const data = JSON.parse(raw);
      const picks = (Array.isArray(data?.picks) ? data.picks : []).map((p: Row) => ({ id: Number(p.tag_id), why: String(p.why ?? '').slice(0, 200) })).filter((p: { id: number }) => validIds.has(p.id)).slice(0, 2);
      next = { ...pick, status: 'done', picks };
    } catch { /* stays an error */ }
  }
  await setJSON(pickKey(purpose), next);
  return next;
}
