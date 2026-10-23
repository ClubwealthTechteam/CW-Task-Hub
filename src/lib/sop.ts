// SOP Handbook runtime data: who marked themselves out today, and each article's POC log.
// The articles themselves live in src/data/sop.tsx.

import { getJSON, setJSON } from '@/lib/store';
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
