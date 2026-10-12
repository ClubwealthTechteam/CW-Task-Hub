// Updates Zaps send into the hub (Zapier → "Webhooks by Zapier: POST" → /api/zapier/inbox?key=…), plus a
// line for every Zap the hub starts. Kept as one rolling list of the latest entries.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';

export interface FeedEntry {
  id: string;
  at: number;
  direction: 'in' | 'out';
  zap: string;
  event?: string;
  summary?: string;
  data?: Record<string, unknown>;
  by?: string;
}

const KEY = 'zapier:feed';
const MAX = 300;
const MAX_DATA = 8000;

export const inboxConfigured = () => Boolean(process.env.ZAPIER_INBOUND_SECRET);

export function inboxKeyValid(given: string | null) {
  const secret = process.env.ZAPIER_INBOUND_SECRET;
  if (!secret || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export const listFeed = () => getJSON<FeedEntry[]>(KEY, []);

export async function addToFeed(entry: Omit<FeedEntry, 'id' | 'at'>) {
  let data = entry.data;
  if (data && JSON.stringify(data).length > MAX_DATA) data = { note: 'Data too large; trimmed', preview: JSON.stringify(data).slice(0, MAX_DATA) };
  const full: FeedEntry = { ...entry, data, id: crypto.randomUUID(), at: Date.now() };
  await setJSON(KEY, [full, ...(await listFeed())].slice(0, MAX));
  return full;
}
