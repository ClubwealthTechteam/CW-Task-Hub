// Daily CW Assistant limit per person (each message runs a Claude routine). Super admins have no limit.
// CHAT_DAILY_LIMIT sets the number (default 20); the day resets at midnight Pacific time.

import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { getJSON, setJSON } from '@/lib/store';

export const dailyLimit = () => Math.max(1, Number(process.env.CHAT_DAILY_LIMIT) || 20);

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const key = (uid: string) => `chat:usage:${uid}:${today()}`;

export interface Usage { used: number; limit: number | null; left: number | null }

export async function usageFor(user: Person): Promise<Usage> {
  if (isSuperAdmin(user)) return { used: 0, limit: null, left: null };
  const used = await getJSON<number>(key(user.id), 0);
  const limit = dailyLimit();
  return { used, limit, left: Math.max(0, limit - used) };
}

export async function countMessage(user: Person) {
  if (isSuperAdmin(user)) return;
  await setJSON(key(user.id), (await getJSON<number>(key(user.id), 0)) + 1);
}
