// The Social Media content calendar (Jay Mar's task #9): posts for events, testimonials,
// promotions, client welcomes and recurring series, each with its platforms, status and owner.
// Stored in the hub; nothing is posted anywhere from here.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';

import { PLATFORMS, POST_TYPES, REPEATS, STATUSES, type CalendarPost, type PostStatus } from './calendar-types';

export * from './calendar-types';

const key = (dept: string) => `calendar:${dept}`;
const MAX = 3000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const listPosts = (dept: string) => getJSON<CalendarPost[]>(key(dept), []);
const save = (dept: string, list: CalendarPost[]) => setJSON(key(dept), list.slice(0, MAX));

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

/** Cleans what the browser sent. Returns an error message, or the fields to save. */
export function cleanPost(body: Record<string, unknown>, people: string[]): { error: string } | { fields: Omit<CalendarPost, 'id' | 'by' | 'at'> } {
  const title = String(body.title ?? '').trim().slice(0, 140);
  const date = String(body.date ?? '');
  const time = String(body.time ?? '').trim();
  const until = String(body.until ?? '').trim();
  if (!title) return { error: 'Add a title' };
  if (!DATE.test(date)) return { error: 'Pick a date' };
  if (time && !TIME.test(time)) return { error: 'Check the time' };
  if (until && (!DATE.test(until) || until < date)) return { error: 'The end date must be after the start date' };
  const link = String(body.link ?? '').trim();
  if (link && !/^https:\/\/\S+$/.test(link)) return { error: 'Links must start with https://' };
  const assignee = String(body.assignee ?? '');
  const repeat = oneOf(REPEATS, body.repeat, 'none');
  const occurrences: Record<string, PostStatus> = {};
  if (body.occurrences && typeof body.occurrences === 'object') {
    for (const [d, s] of Object.entries(body.occurrences as Record<string, unknown>)) if (DATE.test(d) && STATUSES.includes(s as PostStatus)) occurrences[d] = s as PostStatus;
  }
  return {
    fields: {
      title,
      date,
      time: time || undefined,
      type: oneOf(POST_TYPES, body.type, 'other'),
      platforms: Array.isArray(body.platforms) ? PLATFORMS.filter((p) => (body.platforms as unknown[]).includes(p)) : [],
      status: oneOf(STATUSES, body.status, 'idea'),
      assignee: people.includes(assignee) ? assignee : undefined,
      notes: String(body.notes ?? '').trim().slice(0, 4000) || undefined,
      link: link || undefined,
      repeat,
      until: repeat !== 'none' && until ? until : undefined,
      occurrences: repeat !== 'none' && Object.keys(occurrences).length ? occurrences : undefined,
    },
  };
}

export async function addPost(dept: string, fields: Omit<CalendarPost, 'id' | 'by' | 'at'>, by: string) {
  const post: CalendarPost = { ...fields, id: crypto.randomUUID(), by, at: Date.now() };
  await save(dept, [post, ...(await listPosts(dept))]);
  return post;
}

export async function updatePost(dept: string, id: string, fields: Omit<CalendarPost, 'id' | 'by' | 'at'>) {
  const list = await listPosts(dept);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...fields, updated: Date.now() };
  await save(dept, list);
  return list[i];
}

/** Sets the status of one date of a post (the post itself, or one date of a repeating post). */
export async function setStatus(dept: string, id: string, status: PostStatus, date?: string) {
  const list = await listPosts(dept);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const p = list[i];
  if (p.repeat !== 'none' && date && DATE.test(date)) list[i] = { ...p, occurrences: { ...p.occurrences, [date]: status }, updated: Date.now() };
  else list[i] = { ...p, status, updated: Date.now() };
  await save(dept, list);
  return list[i];
}

export async function deletePost(dept: string, id: string) {
  await save(dept, (await listPosts(dept)).filter((p) => p.id !== id));
}

