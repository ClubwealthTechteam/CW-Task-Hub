// Saved call notes (hub storage only; Keap is never written). Kept 90 days after a client's last call.

import { getJSON, setJSON } from '@/lib/store';
import { clientKey, type CallClient, type CallEntry } from './notes';
import type { Person } from '@/config/people';

const KEY = 'calls:clients';
const KEEP_MS = 90 * 24 * 60 * 60 * 1000;

export const canUseCallNotes = (p: Person) => p.role === 'super_admin' || p.departments.includes('client-care');

export async function listClients(): Promise<CallClient[]> {
  const all = await getJSON<Record<string, CallClient>>(KEY, {});
  const cutoff = Date.now() - KEEP_MS;
  return Object.values(all).filter((c) => (c.entries.at(-1)?.at ?? 0) > cutoff).sort((a, b) => (b.entries.at(-1)?.at ?? 0) - (a.entries.at(-1)?.at ?? 0));
}

export async function addEntry(name: string, entry: CallEntry) {
  const all = await getJSON<Record<string, CallClient>>(KEY, {});
  const key = clientKey(name);
  const cur = all[key] ?? { key, name: name.trim(), entries: [] };
  cur.entries = [...cur.entries, entry].slice(-50);
  all[key] = cur;
  const cutoff = Date.now() - KEEP_MS;
  for (const [k, c] of Object.entries(all)) if ((c.entries.at(-1)?.at ?? 0) < cutoff) delete all[k];
  await setJSON(KEY, all);
  return cur;
}

/** Removes one entry (undo a mistake). */
export async function removeEntry(key: string, at: number) {
  const all = await getJSON<Record<string, CallClient>>(KEY, {});
  const cur = all[key];
  if (!cur) return null;
  cur.entries = cur.entries.filter((e) => e.at !== at);
  if (cur.entries.length) all[key] = cur; else delete all[key];
  await setJSON(KEY, all);
  return cur.entries.length ? cur : null;
}
