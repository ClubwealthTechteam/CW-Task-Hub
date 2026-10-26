// SOP Handbook runtime data: who marked themselves out today, and each article's POC log.
// The articles themselves live in src/data/sop.tsx.

import { deleteKey, getJSON, setJSON } from '@/lib/store';
import { todayPacific } from '@/lib/calendar-dates';

export const WHAT_MAX = 500;
export const UNUSUAL_MAX = 500;
const LOG_KEEP = 200;

export interface SopLogEntry {
  at: number;
  /** Person id of whoever did the task. */
  by: string;
  what: string;
  unusual: string;
}

const OUT_KEY = 'sop:out';
const logKey = (articleId: string) => `sop:log:${articleId.toUpperCase()}`;

/** Person ids marked out today (Pacific date). A mark from an earlier day no longer counts. */
export async function outToday(): Promise<Set<string>> {
  const marks = await getJSON<Record<string, string>>(OUT_KEY, {});
  const today = todayPacific();
  return new Set(Object.entries(marks).filter(([, day]) => day === today).map(([id]) => id));
}

export async function setOut(personId: string, out: boolean) {
  const marks = await getJSON<Record<string, string>>(OUT_KEY, {});
  if (out) marks[personId] = todayPacific();
  else delete marks[personId];
  await setJSON(OUT_KEY, marks);
}

/** Newest first. */
export async function sopLog(articleId: string): Promise<SopLogEntry[]> {
  return getJSON<SopLogEntry[]>(logKey(articleId), []);
}

export async function addSopLog(articleId: string, entry: Omit<SopLogEntry, 'at'>): Promise<SopLogEntry> {
  const full = { ...entry, at: Date.now() };
  const log = await sopLog(articleId);
  await setJSON(logKey(articleId), [full, ...log].slice(0, LOG_KEEP));
  return full;
}

// Step screenshots pasted on the article page. Only the people in SHOT_EDITORS can add or remove them;
// everyone signed in sees them. Each image is kept under its own key, with a small index of which steps have one.
export const SHOT_EDITORS = ['miguel'];
/** Base64 data URL cap. The page shrinks a pasted image (1600px, WebP) well under this before sending it. */
export const SHOT_MAX = 900_000;
const SHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface SopShot { type: string; data: string; at: number }

const shotKey = (articleId: string, step: number) => `sop:shot:${articleId.toUpperCase()}:${step}`;
const shotIndexKey = (articleId: string) => `sop:shots:${articleId.toUpperCase()}`;

export const canEditShots = (personId: string) => SHOT_EDITORS.includes(personId);

/** Step number → when its screenshot was pasted (also used to bust the image cache). */
export async function sopShots(articleId: string): Promise<Record<number, number>> {
  return getJSON<Record<number, number>>(shotIndexKey(articleId), {});
}

export async function getSopShot(articleId: string, step: number): Promise<SopShot | null> {
  return getJSON<SopShot | null>(shotKey(articleId, step), null);
}

/** Saves a "data:image/...;base64,..." URL as a step's screenshot. Returns an error message, or null when saved. */
export async function setSopShot(articleId: string, step: number, dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !SHOT_TYPES.includes(m[1])) return 'Paste a PNG, JPG or WebP image';
  if (dataUrl.length > SHOT_MAX) return 'That image is too big. Crop it a little and paste again';
  const at = Date.now();
  await setJSON(shotKey(articleId, step), { type: m[1], data: m[2], at });
  await setJSON(shotIndexKey(articleId), { ...(await sopShots(articleId)), [step]: at });
  return null;
}

export async function deleteSopShot(articleId: string, step: number) {
  await deleteKey(shotKey(articleId, step));
  const index = await sopShots(articleId);
  delete index[step];
  await setJSON(shotIndexKey(articleId), index);
}
