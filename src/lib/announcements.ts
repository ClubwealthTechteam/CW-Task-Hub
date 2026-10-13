// Updates and announcements super admins post for the team. Shown on the admin home page, as a banner at
// the top of each person's workspace, and on /updates.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';
import { isSuperAdmin } from '@/lib/access';
import { personById, type Person } from '@/config/people';
import { departmentById, type DepartmentId } from '@/config/departments';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** 'all', or one department. Super admins see every announcement. */
  audience: 'all' | DepartmentId;
  pinned: boolean;
  by: string;
  at: number;
  edited?: number;
}

const KEY = 'announcements';
const MAX = 100;
export const TITLE_MAX = 120;
export const BODY_MAX = 4000;

const all = () => getJSON<Announcement[]>(KEY, []);
const save = (list: Announcement[]) => setJSON(KEY, list.slice(0, MAX));

/** Pinned first, then newest first. */
const order = (a: Announcement, b: Announcement) => Number(b.pinned) - Number(a.pinned) || b.at - a.at;

export async function announcementsFor(user: Person) {
  const list = await all();
  return list.filter((a) => isSuperAdmin(user) || a.audience === 'all' || user.departments.includes(a.audience)).sort(order);
}

export async function addAnnouncement(input: Omit<Announcement, 'id' | 'at'>) {
  const entry: Announcement = { ...input, id: crypto.randomUUID(), at: Date.now() };
  await save([entry, ...(await all())]);
  return entry;
}

export async function updateAnnouncement(id: string, patch: Partial<Pick<Announcement, 'title' | 'body' | 'audience' | 'pinned'>>) {
  const list = await all();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const edited = patch.title !== undefined || patch.body !== undefined ? Date.now() : list[i].edited;
  list[i] = { ...list[i], ...patch, edited };
  await save(list);
  return list[i];
}

export async function deleteAnnouncement(id: string) {
  await save((await all()).filter((a) => a.id !== id));
}

/** What the page components need: names instead of ids. */
export const toView = (a: Announcement) => ({
  ...a,
  audienceName: a.audience === 'all' ? 'Everyone' : departmentById(a.audience)?.name ?? a.audience,
  byName: personById(a.by)?.name ?? a.by,
});
