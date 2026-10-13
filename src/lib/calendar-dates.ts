// Date helpers for the content calendar, used on the server and in the browser. Dates are plain
// YYYY-MM-DD strings so a post stays on the day it was planned for, whatever the viewer's time zone.

export interface Repeatable {
  date: string;
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly';
  until?: string;
}

const parts = (d: string) => d.split('-').map(Number) as [number, number, number];

export const toDate = (d: string) => { const [y, m, day] = parts(d); return new Date(Date.UTC(y, m - 1, day)); };
export const fromDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + n); return fromDate(x); };
export const weekday = (d: string) => toDate(d).getUTCDay(); // 0 = Sunday

/** Monday of the week that holds this date. */
export const weekStart = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

/** Today in Pacific time, as YYYY-MM-DD. */
export const todayPacific = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function occursOn(p: Repeatable, day: string): boolean {
  if (day < p.date || (p.until && day > p.until)) return false;
  if (p.repeat === 'none') return day === p.date;
  const [y0, m0, d0] = parts(p.date);
  const [y, m, d] = parts(day);
  if (p.repeat === 'weekly') return weekday(day) === weekday(p.date);
  // Monthly and yearly posts on the 29th-31st fall on the last day of shorter months.
  if (p.repeat === 'monthly') return d === Math.min(d0, daysInMonth(y, m));
  return m === m0 && d === Math.min(d0, daysInMonth(y, m));
}

/** Every date from `from` to `to` (inclusive) that the post falls on. */
export function occurrencesBetween(p: Repeatable, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from > p.date ? from : p.date; d <= to; d = addDays(d, 1)) {
    if (p.until && d > p.until) break;
    if (occursOn(p, d)) out.push(d);
  }
  return out;
}
