// SOP review schedule and adoption numbers (the "Review and Update" part of each article).
// Pure functions, so the handbook index and the article page work them out the same way.

import { REVIEW_EVERY_DAYS, type SopArticle } from '@/data/sop';
import type { SopLogEntry } from '@/lib/sop';

const DAY = 86_400_000;
const fmt = (t: number) => new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

export interface ReviewDue {
  /** "Jan 24, 2027" */
  due: string;
  overdue: boolean;
  /** Days until due (negative once overdue). */
  days: number;
}

/** The next review date: lastReviewed + the article's review period. */
export function reviewDue(a: SopArticle, now = Date.now()): ReviewDue {
  const last = Date.parse(`${a.lastReviewed} UTC`);
  const dueAt = last + (a.reviewEveryDays ?? REVIEW_EVERY_DAYS) * DAY;
  const days = Math.ceil((dueAt - now) / DAY);
  return { due: fmt(dueAt), overdue: days < 0, days };
}

export const currentVersion = (a: SopArticle) => a.versions[a.versions.length - 1];

export interface AdoptionWindow { days: number; runs: number; issues: number }

/** Runs (POC log rows) and issues (rows with "anything unusual" filled in) in the last 30, 60 and 90 days. */
export function adoption(log: SopLogEntry[], now = Date.now()): AdoptionWindow[] {
  return [30, 60, 90].map((days) => {
    const rows = log.filter((e) => e.at >= now - days * DAY);
    return { days, runs: rows.length, issues: rows.filter((e) => e.unusual.trim()).length };
  });
}
