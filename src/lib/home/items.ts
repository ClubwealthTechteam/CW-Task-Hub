// Each person's own urgent tasks and to-do list for their home page (home:items:<uid>).
// Private to that person: nobody else's home shows them, and super admins don't see them either.

import { getJSON, setJSON } from '@/lib/store';

export type ItemKind = 'urgent' | 'hot' | 'todo';

export interface HomeItem {
  id: string;
  kind: ItemKind;
  text: string;
  done: boolean;
  /** YYYY-MM-DD, optional. */
  due?: string;
  createdAt: number;
  doneAt?: number;
}

const MAX_ITEMS = 200;
const MAX_TEXT = 300;
const key = (uid: string) => `home:items:${uid}`;
const KINDS: ItemKind[] = ['urgent', 'hot', 'todo'];

export const listItems = (uid: string) => getJSON<HomeItem[]>(key(uid), []);
const save = (uid: string, items: HomeItem[]) => setJSON(key(uid), items.slice(0, MAX_ITEMS));

const cleanDue = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const cleanText = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

export async function addItem(uid: string, input: { kind?: unknown; text?: unknown; due?: unknown }) {
  const text = cleanText(input.text);
  if (!text) throw new Error('Type something first');
  const kind = KINDS.includes(input.kind as ItemKind) ? (input.kind as ItemKind) : 'todo';
  const item: HomeItem = {
    id: `i_${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
    kind, text, done: false, createdAt: Date.now(), ...(cleanDue(input.due) ? { due: cleanDue(input.due) } : {}),
  };
  const items = await listItems(uid);
  if (items.length >= MAX_ITEMS) throw new Error(`You can keep up to ${MAX_ITEMS} items. Clear some done ones first.`);
  items.unshift(item);
  await save(uid, items);
  return item;
}

export async function updateItem(uid: string, id: string, patch: { done?: unknown; text?: unknown; due?: unknown; kind?: unknown }) {
  const items = await listItems(uid);
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  if (typeof patch.done === 'boolean') { item.done = patch.done; item.doneAt = patch.done ? Date.now() : undefined; }
  if (patch.text !== undefined) { const t = cleanText(patch.text); if (t) item.text = t; }
  if (patch.due !== undefined) item.due = cleanDue(patch.due);
  if (KINDS.includes(patch.kind as ItemKind)) item.kind = patch.kind as ItemKind;
  await save(uid, items);
  return item;
}

export async function removeItems(uid: string, ids: string[]) {
  const drop = new Set(ids);
  const items = await listItems(uid);
  await save(uid, items.filter((i) => !drop.has(i.id)));
}
