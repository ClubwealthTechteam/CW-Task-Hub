// Team adoption for the super admin home: who opens the hub, who uses the assistant, which tasks get used.
// "Active" means the person opened a hub page that day (recorded at most once an hour per person) or
// sent the assistant a message. Previews by super admins never count.

import { PEOPLE } from '@/config/people';
import { departmentById } from '@/config/departments';
import { getJSON, setJSON } from '@/lib/store';

const KEEP_DAYS = 60;
const pacific = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const key = (uid: string) => `adopt:days:${uid}`;
const lastWrite = new Map<string, number>();

/** Notes that this person used the hub today. Cheap: skips the write if this server did it within the hour. */
export async function markActive(uid: string) {
  const now = Date.now();
  if ((lastWrite.get(uid) ?? 0) > now - 3_600_000) return;
  lastWrite.set(uid, now);
  const today = pacific(now);
  const days = await getJSON<string[]>(key(uid), []);
  if (days[0] === today) return;
  await setJSON(key(uid), [today, ...days.filter((d) => d !== today)].slice(0, KEEP_DAYS));
}

export interface PersonUse { messageDays: string[]; messages7: number; messagesPrev7: number; tasks: string[]; lastMessage: number }

export interface AdoptionRow {
  id: string; name: string; dept: string;
  /** The last 14 days, oldest first: 0 = not active, 1 = opened the hub, 2 = also used the assistant. */
  strip: number[];
  activeDays14: number; messages7: number; tasksUsed: number; lastActive: string | null;
}

export async function adoptionData(use: Record<string, PersonUse>, totalTasks: number) {
  const now = Date.now();
  const days14 = Array.from({ length: 14 }, (_, i) => pacific(now - (13 - i) * 86_400_000));
  const week = new Set(days14.slice(-7));
  const prevWeek = new Set(days14.slice(0, 7));
  const members = PEOPLE.filter((p) => p.role !== 'super_admin');
  const seen = await Promise.all(members.map((p) => getJSON<string[]>(key(p.id), []).catch(() => [] as string[])));

  const rows: AdoptionRow[] = members.map((p, i) => {
    const u = use[p.id];
    const msgDays = new Set(u?.messageDays ?? []);
    const opened = new Set([...seen[i], ...msgDays]);
    const strip = days14.map((d) => (msgDays.has(d) ? 2 : opened.has(d) ? 1 : 0));
    const last = [...opened].sort().pop() ?? null;
    return {
      id: p.id, name: p.name, dept: departmentById(p.departments[0])?.name ?? '',
      strip, activeDays14: strip.filter(Boolean).length, messages7: u?.messages7 ?? 0, tasksUsed: u?.tasks.length ?? 0, lastActive: last,
    };
  }).sort((a, b) => b.activeDays14 - a.activeDays14 || b.messages7 - a.messages7 || a.name.localeCompare(b.name));

  const activeIn = (set: Set<string>) => rows.filter((r) => r.strip.some((v, i) => v && set.has(days14[i]))).length;
  const activeWeek = activeIn(week), activePrev = activeIn(prevWeek);
  const messagesWeek = rows.reduce((n, r) => n + r.messages7, 0);
  const usedTasks = new Set(Object.values(use).flatMap((u) => u.tasks));
  return {
    members: members.length, activeWeek, activePrev,
    perActive: activeWeek ? Math.round((messagesWeek / activeWeek) * 10) / 10 : 0,
    tasksUsed: usedTasks.size, totalTasks,
    neverOpened: rows.filter((r) => !r.lastActive).map((r) => r.name),
    days: days14, rows,
  };
}
export type AdoptionData = Awaited<ReturnType<typeof adoptionData>>;
