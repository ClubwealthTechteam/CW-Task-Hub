// REality intro emails: batches of half-day attendees who ticked "Recruiting". The REality routine reads the
// REALITY QUEUE sheet tab, posts a batch here and DMs Am and Miguel that it's waiting. Am (or a super admin)
// reviews it on /reality, can leave people out, previews each email and presses Send. That fires the routine,
// which sends the emails, completes the Keap tasks, emails Jessica the list, and posts the results back here.

import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { deleteKey, getJSON, setJSON, setJSONIfAbsent } from '@/lib/store';

export const canUseReality = (user: Person | null | undefined) => Boolean(user) && (isSuperAdmin(user) || user?.id === 'amrissa');

export type PersonStatus = 'waiting' | 'left out' | 'sent' | 'skipped';
export interface RealityPerson {
  row: number; keapId: string; first: string; last: string; email: string; location: string;
  status: PersonStatus; note?: string; sentAt?: string;
}
export type BatchStatus = 'waiting' | 'approved' | 'sending' | 'done';
export interface RealityBatch {
  id: string; createdAt: string; status: BatchStatus; people: RealityPerson[];
  approvedBy?: string; approvedAt?: string; doneAt?: string;
  list?: { sent: boolean; count: number; leftOut: string[] };
  summary?: string;
}

const KEY = 'reality:batches';
const KEEP = 100;
export const MAX_BATCH = 50;
const CLAIM_SECONDS = 30 * 60;

export async function allBatches(): Promise<RealityBatch[]> {
  return getJSON<RealityBatch[]>(KEY, []);
}
async function save(batches: RealityBatch[]) {
  await setJSON(KEY, batches.slice(-KEEP));
}
export async function findBatch(id: string) {
  return (await allBatches()).find((b) => b.id === id);
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Checks the rows the routine sends; returns the clean people or an error message. */
export function cleanRows(rows: unknown): { people: RealityPerson[] } | { error: string } {
  if (!Array.isArray(rows) || !rows.length) return { error: 'Send rows: a non-empty list' };
  if (rows.length > MAX_BATCH) return { error: `At most ${MAX_BATCH} people per batch` };
  const people: RealityPerson[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const row = Number(r?.row);
    const keapId = String(r?.keapId ?? '').trim();
    const p: RealityPerson = { row, keapId, first: str(r?.first, 80), last: str(r?.last, 80), email: str(r?.email, 200).toLowerCase(), location: str(r?.location, 80), status: 'waiting' };
    if (!Number.isInteger(row) || row < 2 || !/^\d{1,12}$/.test(keapId) || !p.first || !EMAIL.test(p.email) || !p.location) {
      return { error: `Row ${r?.row ?? '?'}: needs row, keapId, first, a valid email and location` };
    }
    if (people.some((x) => x.row === row)) return { error: `Row ${row} is in the list twice` };
    people.push(p);
  }
  return { people };
}

/** The routine posts a new batch. Only one batch waits for review at a time. */
export async function createBatch(people: RealityPerson[], now = new Date()) {
  const batches = await allBatches();
  const open = batches.find((b) => b.status === 'waiting' || b.status === 'approved' || b.status === 'sending');
  if (open) return { error: 'A batch is still open', batch: open };
  const batch: RealityBatch = { id: `rb${now.getTime().toString(36)}`, createdAt: now.toISOString(), status: 'waiting', people };
  await save([...batches, batch]);
  return { batch };
}

/** Am or a super admin presses Send. `leaveOut` are sheet rows she unticked. */
export async function approveBatch(id: string, user: Person, leaveOut: number[], now = new Date()) {
  const batches = await allBatches();
  const b = batches.find((x) => x.id === id);
  if (!b) return { error: 'Batch not found' };
  if (b.status !== 'waiting') return { error: 'This batch was already sent or is sending' };
  for (const p of b.people) p.status = leaveOut.includes(p.row) ? 'left out' : 'waiting';
  if (!b.people.some((p) => p.status === 'waiting')) return { error: 'Pick at least one person to email' };
  b.status = 'approved'; b.approvedBy = user.name; b.approvedAt = now.toISOString();
  await save(batches);
  return { batch: b };
}

/** The routine claims an approved batch before sending, so two runs never send the same batch. */
export async function claimBatch(id: string) {
  const b = await findBatch(id);
  if (!b) return { error: 'Batch not found' };
  if (b.status !== 'approved' && b.status !== 'sending') return { error: `Batch is ${b.status}` };
  const got = await setJSONIfAbsent(`reality:claim:${id}`, { at: new Date().toISOString() }, CLAIM_SECONDS);
  if (!got) return { error: 'Another run is sending this batch' };
  const batches = await allBatches();
  const x = batches.find((y) => y.id === id) as RealityBatch;
  x.status = 'sending';
  await save(batches);
  return { batch: x };
}

export interface PersonResult { row: number; status: 'sent' | 'skipped'; note?: string; sentAt?: string }

/** The routine reports what happened. `done` closes the batch (with the list for Jessica). */
export async function recordResults(id: string, results: PersonResult[], done: boolean, list?: RealityBatch['list'], summary?: string, now = new Date()) {
  const batches = await allBatches();
  const b = batches.find((x) => x.id === id);
  if (!b) return { error: 'Batch not found' };
  for (const r of results) {
    const p = b.people.find((x) => x.row === r.row);
    if (!p || p.status === 'left out' || p.status === 'sent') continue;
    p.status = r.status === 'sent' ? 'sent' : 'skipped';
    p.note = r.note ? String(r.note).slice(0, 200) : undefined;
    p.sentAt = r.status === 'sent' ? (r.sentAt || now.toISOString()) : undefined;
  }
  if (list) b.list = { sent: Boolean(list.sent), count: Number(list.count) || 0, leftOut: (list.leftOut ?? []).map((s) => String(s).slice(0, 120)).slice(0, 50) };
  if (summary) b.summary = String(summary).slice(0, 300);
  if (done) { b.status = 'done'; b.doneAt = now.toISOString(); await deleteKey(`reality:claim:${id}`).catch(() => null); }
  await save(batches);
  return { batch: b };
}
