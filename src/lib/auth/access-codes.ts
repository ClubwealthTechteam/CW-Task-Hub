// Per-person access codes (until CW University / Google sign-in). HUB_ACCESS_CODES is a JSON map of
// person id → code, set only in Vercel, never in the repo. While it isn't set, the old shared
// HUB_ACCESS_CODE still works so nobody is locked out during the switch.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function codes(): Record<string, string> | null {
  const raw = process.env.HUB_ACCESS_CODES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    console.error('HUB_ACCESS_CODES is not valid JSON');
    return {};
  }
}

const digest = (s: string) => crypto.createHash('sha256').update(s).digest();
const same = (a: string, b: string) => crypto.timingSafeEqual(digest(a), digest(b));

/** Which sign-in is active, for /api/health (never the codes themselves). */
export const signInMode = () => (codes() ? 'personal_codes' : process.env.HUB_ACCESS_CODE ? 'shared_code' : 'not_set_up');

export type CodeCheck = 'ok' | 'wrong' | 'no_code' | 'not_set_up';

export function checkAccessCode(personId: string, given: string): CodeCheck {
  const map = codes();
  if (map) {
    const expected = map[personId];
    if (!expected) return 'no_code';
    return same(String(given ?? '').trim(), expected) ? 'ok' : 'wrong';
  }
  const shared = process.env.HUB_ACCESS_CODE;
  if (!shared) return process.env.NODE_ENV === 'production' ? 'not_set_up' : 'ok';
  return same(String(given ?? '').trim(), shared) ? 'ok' : 'wrong';
}

// Too many wrong codes for one name locks that name for 15 minutes.
interface Fails { count: number; until?: number }
const failKey = (personId: string) => `login:fails:${personId}`;

export async function lockedUntil(personId: string) {
  const f = await getJSON<Fails>(failKey(personId), { count: 0 });
  return f.until && f.until > Date.now() ? f.until : null;
}

export async function recordFailure(personId: string) {
  const f = await getJSON<Fails>(failKey(personId), { count: 0 });
  const count = (f.until && f.until <= Date.now() ? 0 : f.count) + 1;
  await setJSON(failKey(personId), count >= MAX_FAILS ? { count, until: Date.now() + LOCK_MS } : { count });
}

export const clearFailures = (personId: string) => setJSON(failKey(personId), { count: 0 });
