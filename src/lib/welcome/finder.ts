// Claude finds the new clients: the hub gathers evidence from Keap (read-only) — paid orders and client-type
// tags applied in the look-back window — and Claude decides, in a background chat, who actually became a
// new Club Wealth client (not leads, event-ticket buyers or renewals), with a short reason for each.

import type { Person } from '@/config/people';
import { callKeap } from '@/lib/integrations/keap/client';
import { candidates as tagCandidates } from '@/lib/integrations/keap/tag-suggest';
import { buildPayload, chatIsConfigured, fireChatRoutine } from '@/lib/chat/routine';
import { createConversation, getConversation, newId, saveConversation, type ChatMessage } from '@/lib/chat/store';
import { getJSON, setJSON } from '@/lib/store';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface FoundClient { id: number; first: string; last: string; email?: string; signedUp: string; why: string }
export interface Finding { status: 'thinking' | 'done' | 'error'; at: number; days: number; looked: number; clients: FoundClient[]; conversationId?: string; messageId?: string; error?: string }

const KEY = 'welcome:found';
const MAX_PEOPLE = 120;
export const REFIND_MS = 12 * 60 * 60 * 1000;

export const getFinding = () => getJSON<Finding | null>(KEY, null);

interface Evidence { id: number; first: string; last: string; email?: string; first_seen: string; signals: string[] }

async function gather(days: number) {
  const since = Date.now() - days * 86_400_000;
  const people = new Map<number, Evidence>();
  const add = (c: Row | undefined, when: string, signal: string) => {
    const id = Number(c?.id);
    if (!id) return;
    const p: Evidence = people.get(id) ?? { id, first: c?.first_name ?? c?.given_name ?? '', last: c?.last_name ?? c?.family_name ?? '', email: c?.email, first_seen: when, signals: [] };
    if (when < p.first_seen) p.first_seen = when;
    if (p.signals.length < 6) p.signals.push(signal);
    people.set(id, p);
  };
  // Paid orders: what they bought and when.
  for (let offset = 0; offset < 3000; offset += 1000) {
    const body = (await callKeap('orders.list', { since: new Date(since).toISOString(), limit: 1000, offset }).catch(() => null)) as Row | null;
    const rows: Row[] = body?.orders ?? [];
    for (const o of rows) {
      const when = String(o.order_date ?? o.creation_date ?? '').slice(0, 10);
      const items = (o.order_items ?? []).map((i: Row) => i.name ?? i.product?.name).filter(Boolean).join(', ') || o.title || 'an order';
      add(o.contact, when, `Order ${when}: ${items}${o.total != null ? ` ($${o.total})` : ''}${o.status ? ` · ${o.status}` : ''}`);
    }
    if (rows.length < 1000) break;
  }
  // Client-type tags applied in the window.
  for (const t of (await tagCandidates('new-client').catch(() => [])).slice(0, 6)) {
    for (let offset = 0; offset < 3000; offset += 1000) {
      const body = (await callKeap('tags.contacts', { tagId: t.id, limit: 1000, offset })) as Row;
      const rows: Row[] = body?.contacts ?? [];
      for (const r of rows) if (Date.parse(r.date_applied ?? '') >= since) add(r.contact, String(r.date_applied).slice(0, 10), `Tagged "${t.name}" on ${String(r.date_applied).slice(0, 10)}`);
      if (rows.length < 1000) break;
    }
  }
  return [...people.values()].sort((a, b) => b.first_seen.localeCompare(a.first_seen)).slice(0, MAX_PEOPLE);
}

export async function startFinding(user: Person, days: number): Promise<Finding> {
  const prev = await getFinding();
  const base: Finding = { status: 'error', at: Date.now(), days, looked: 0, clients: prev?.clients ?? [] };
  if (!chatIsConfigured()) { await setJSON(KEY, { ...base, error: 'The assistant isn’t switched on yet' }); return { ...base, error: 'The assistant isn’t switched on yet' }; }
  const people = await gather(days);
  if (!people.length) { const f: Finding = { ...base, status: 'done', clients: [] }; await setJSON(KEY, f); return f; }
  const conv = createConversation(user.id, 'New client finder', 'jaymar-1');
  conv.background = true;
  const now = Date.now();
  const text = [
    'NEW CLIENT FINDER: a background request from the New Client Welcome Posts board. Do NOT make graphics.',
    `Below is evidence from Club Wealth's Keap for the last ${days} days: people with paid orders and/or client-type tags applied.`,
    'Decide which of them BECAME A NEW CLUB WEALTH CLIENT in this period (signed up for coaching, membership or a program), so the social team can post a welcome.',
    'Leave out: leads and prospects, people who only bought Half-Day / event / webinar tickets or a low-cost product, refunds or cancellations, and existing clients renewing or paying an instalment. When unsure, leave them out.',
    'Reply with ONLY one ```json code block: {"clients":[{"contact_id":123,"signed_up":"YYYY-MM-DD","why":"one short reason, e.g. Bought Elite Coaching on Oct 10"}]}',
    '',
    'PEOPLE (contact_id · name · earliest date · evidence):',
    ...people.map((p) => `- ${p.id} · ${[p.first, p.last].filter(Boolean).join(' ') || '(no name)'} · ${p.first_seen} · ${p.signals.join(' | ')}`),
  ].join('\n');
  const asked: ChatMessage = { id: newId('m'), role: 'user', text, at: now, status: 'done' };
  const reply: ChatMessage = { id: newId('m'), role: 'assistant', text: '', at: now, status: 'pending' };
  conv.messages.push(asked, reply);
  await saveConversation(conv);
  const finding: Finding = { ...base, status: 'thinking', looked: people.length, conversationId: conv.id, messageId: reply.id };
  try {
    await fireChatRoutine(await buildPayload(user, conv, asked.id, reply.id));
  } catch (e) {
    finding.status = 'error';
    finding.error = (e as Error).message;
  }
  // Remember who was looked at, so the answer can be checked against them.
  await setJSON(`${KEY}:people`, people.map((p) => ({ id: p.id, first: p.first, last: p.last, email: p.email, first_seen: p.first_seen })));
  await setJSON(KEY, finding);
  return finding;
}

/** Picks up Claude's answer when it has arrived. */
export async function collectFinding(): Promise<Finding | null> {
  const f = await getFinding();
  if (!f || f.status !== 'thinking') return f;
  const conv = await getConversation(f.conversationId ?? '');
  const msg = conv?.messages.find((m) => m.id === f.messageId);
  if (!msg || msg.status === 'pending') return f;
  const people = new Map((await getJSON<Evidence[]>(`${KEY}:people`, [])).map((p) => [p.id, p]));
  let next: Finding = { ...f, status: 'error', error: 'Claude’s answer couldn’t be read. Try again.' };
  if (msg.status === 'done') {
    try {
      const raw = msg.text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? msg.text.slice(msg.text.indexOf('{'), msg.text.lastIndexOf('}') + 1);
      const rows: Row[] = JSON.parse(raw)?.clients ?? [];
      const clients = rows.map((r) => {
        const p = people.get(Number(r.contact_id));
        if (!p) return null;
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(r.signed_up)) ? String(r.signed_up) : p.first_seen;
        return { id: p.id, first: p.first, last: p.last, email: p.email, signedUp: `${d}T12:00:00.000Z`, why: String(r.why ?? '').slice(0, 160) };
      }).filter(Boolean) as FoundClient[];
      next = { ...f, status: 'done', clients, error: undefined };
    } catch { /* stays an error */ }
  } else next = { ...f, status: 'error', error: msg.text };
  await setJSON(KEY, next);
  return next;
}
