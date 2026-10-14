// A small error log so problems show up without someone having to complain: page crashes reported by
// browsers, and failures in the hub's own server code. Kept 14 days, newest first (errors:log).
// Super admins see the latest on the home page; /api/health shows only the count; the daily health
// check reports it in #cw-assistant.

import { getJSON, setJSON } from '@/lib/store';

export interface ErrorEntry { at: number; where: 'browser' | 'server'; message: string; path?: string; user?: string; count: number }

const KEY = 'errors:log';
const MAX = 150;
const KEEP_MS = 14 * 86_400_000;

const clean = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Records an error; the same message on the same page within an hour just bumps its count. */
export async function logError(where: ErrorEntry['where'], message: unknown, extra: { path?: unknown; user?: string } = {}) {
  try {
    const msg = clean(message instanceof Error ? message.message : message, 300);
    if (!msg) return;
    const path = clean(extra.path, 200) || undefined;
    const now = Date.now();
    const list = (await getJSON<ErrorEntry[]>(KEY, [])).filter((e) => e.at > now - KEEP_MS);
    const same = list.find((e) => e.message === msg && e.path === path && e.where === where && e.at > now - 3_600_000);
    if (same) { same.count += 1; same.at = now; if (extra.user) same.user = extra.user; }
    else list.unshift({ at: now, where, message: msg, path, user: extra.user, count: 1 });
    await setJSON(KEY, list.sort((a, b) => b.at - a.at).slice(0, MAX));
  } catch { /* logging must never break the page */ }
}

export async function recentErrors(hours = 24) {
  const since = Date.now() - hours * 3_600_000;
  const list = (await getJSON<ErrorEntry[]>(KEY, []).catch(() => [] as ErrorEntry[])).filter((e) => e.at > since);
  return { count: list.reduce((n, e) => n + e.count, 0), items: list };
}
