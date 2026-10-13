// Jizel's daily Accounts Receivable list, read from Keap (read-only): every client with an unpaid balance,
// grouped by client and aged from the order date, plus what changed since the previous working day
// (paid off, newly overdue, balance changed). Replaces exporting the AR Aging Report and comparing by hand.

import { callKeap } from '@/lib/integrations/keap/client';
import { cached, getJSON, setJSONFor, scanKeys } from '@/lib/store';
import type { Person } from '@/config/people';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ArOrder { id: number; title: string; date: string; total: number; due: number }
export interface ArClient {
  contactId: number;
  name: string;
  email?: string;
  company?: string;
  due: number;
  oldest: string;          // date of the oldest unpaid order (YYYY-MM-DD)
  days: number;            // days since then
  orders: ArOrder[];
}
export interface ArChange { contactId: number; name: string; before: number; after: number }
export interface ArReport {
  at: number;
  date: string;                   // today (Pacific)
  comparedTo: string | null;      // the previous snapshot's date
  clients: ArClient[];
  total: number;
  isNew: number[];                // contact ids with a balance today and none on the compared day
  paid: ArChange[];               // had a balance then, none now
  changed: ArChange[];            // balance went up or down
}

const SNAP = (date: string) => `billing:ar:snap:${date}`;
const KEEP_DAYS = 21;

export const canUseAr = (p: Person) => p.role === 'super_admin' || p.departments.includes('client-care');
export const AR_TASKS = ['jizel-form-exporting-accounts-receivable-ar'];

const pacificDate = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const money = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

/** Every unpaid order in Keap (pages through all of them). */
async function unpaidOrders(): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const body = (await callKeap('orders.list', { paid: false, limit: 1000, offset })) as Row;
    const rows: Row[] = body?.orders ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function readClients(): Promise<ArClient[]> {
  const today = Date.now();
  const byContact = new Map<number, ArClient>();
  for (const o of await unpaidOrders()) {
    const due = money(o.total_due ?? (Number(o.total ?? 0) - Number(o.total_paid ?? 0)));
    const id = Number(o.contact?.id);
    if (!(due > 0) || !id) continue;
    const date = String(o.order_date ?? o.creation_date ?? '').slice(0, 10);
    const c: ArClient = byContact.get(id) ?? {
      contactId: id,
      name: [o.contact?.first_name, o.contact?.last_name].filter(Boolean).join(' ') || o.contact?.email || `Contact #${id}`,
      email: o.contact?.email || undefined,
      company: o.contact?.company_name || undefined,
      due: 0, oldest: date, days: 0, orders: [],
    };
    c.orders.push({ id: Number(o.id), title: String(o.title || o.order_items?.[0]?.name || `Order #${o.id}`), date, total: money(o.total), due });
    c.due = money(c.due + due);
    if (date && (!c.oldest || date < c.oldest)) c.oldest = date;
    byContact.set(id, c);
  }
  return [...byContact.values()].map((c) => ({
    ...c,
    days: c.oldest ? Math.max(0, Math.floor((today - Date.parse(`${c.oldest}T12:00:00Z`)) / 86_400_000)) : 0,
    orders: c.orders.sort((a, b) => a.date.localeCompare(b.date)),
  })).sort((a, b) => b.days - a.days || b.due - a.due);
}

/** The latest snapshot saved before `date`. */
async function previousSnapshot(date: string) {
  const keys = (await scanKeys('billing:ar:snap:*', 200)).map((k) => k.key.slice(SNAP('').length)).filter((d) => d < date).sort();
  const prev = keys.at(-1);
  return prev ? { date: prev, dues: await getJSON<Record<string, { name: string; due: number }>>(SNAP(prev), {}) } : null;
}

export async function arReport(fresh = false): Promise<ArReport> {
  const date = pacificDate();
  const read = () => readClients();
  const clients = fresh ? await read() : await cached('billing:ar:clients', 10 * 60, read);
  // Today's snapshot (overwritten through the day, so tomorrow compares against today's last look).
  const dues = Object.fromEntries(clients.map((c) => [c.contactId, { name: c.name, due: c.due }]));
  const prev = await previousSnapshot(date);
  await setJSONFor(SNAP(date), dues, KEEP_DAYS * 86_400);

  const isNew: number[] = [];
  const paid: ArChange[] = [];
  const changed: ArChange[] = [];
  if (prev) {
    for (const c of clients) {
      const before = prev.dues[c.contactId]?.due;
      if (before === undefined) isNew.push(c.contactId);
      else if (Math.abs(before - c.due) >= 0.01) changed.push({ contactId: c.contactId, name: c.name, before, after: c.due });
    }
    for (const [id, p] of Object.entries(prev.dues)) if (!dues[id]) paid.push({ contactId: Number(id), name: p.name, before: p.due, after: 0 });
  }
  return { at: Date.now(), date, comparedTo: prev?.date ?? null, clients, total: money(clients.reduce((n, c) => n + c.due, 0)), isNew, paid, changed };
}

/** What the task assistant sees on the AR task: the balances and today's changes (read-only from Keap). */
export async function arContext(taskId?: string) {
  if (!taskId || !AR_TASKS.includes(taskId)) return '';
  const r = await arReport();
  const usd = (n: number) => `$${n.toFixed(2)}`;
  return [
    '', '',
    `OVERDUE BALANCES (read from Keap, read-only; ${r.clients.length} clients, ${usd(r.total)} total; compared with ${r.comparedTo ?? 'nothing yet'}). Charging cards and notes are done by Jizel in Keap; the hub never changes Keap.`,
    ...r.clients.slice(0, 40).map((c) => `- ${c.name} (Keap #${c.contactId})${c.company ? `, ${c.company}` : ''}: ${usd(c.due)} due, oldest unpaid ${c.oldest} (${c.days} days)${r.isNew.includes(c.contactId) ? ' · NEW today' : ''}; orders: ${c.orders.map((o) => `${o.title} ${usd(o.due)}`).join('; ')}`),
    r.clients.length > 40 ? `(${r.clients.length - 40} more not listed)` : '',
    r.paid.length ? `Paid off since ${r.comparedTo}: ${r.paid.map((p) => `${p.name} (was ${usd(p.before)})`).join(', ')}` : '',
    r.changed.length ? `Balance changed: ${r.changed.map((c) => `${c.name} ${usd(c.before)} → ${usd(c.after)}`).join(', ')}` : '',
  ].filter((l) => l !== '').join('\n');
}
