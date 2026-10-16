// EOD reports: each team member's end-of-day report (the PDS they used to email Tara), filled in through the
// day and submitted from the hub. Shared by the page and the API (no server-only code here).

export interface EodEntry {
  id: string;
  start: string; // "05:30" (24h, Pacific)
  end: string;   // "06:00"
  task: string;
  notes: string;
  daily: boolean; // "I do this every day": the automation candidates
}

export interface EodReport {
  id: string;        // `${uid}:${date}`
  uid: string;
  date: string;      // YYYY-MM-DD (Pacific)
  entries: EodEntry[];
  highlights: string;
  blockers: string;
  tomorrow: string;
  status: 'draft' | 'submitted';
  submittedAt?: number;
  updatedAt: number;
  edited?: boolean;  // changed after it was submitted
}

export const LIMITS = { entries: 60, task: 160, notes: 2000, text: 2000 };

export const pacificDate = (at = Date.now()) =>
  new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export const reportId = (uid: string, date: string) => `${uid}:${date}`;

export const blankEntry = (start = '', end = ''): EodEntry => ({
  id: `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, start, end, task: '', notes: '', daily: false,
});

export const emptyReport = (uid: string, date: string): EodReport => ({
  id: reportId(uid, date), uid, date, entries: [], highlights: '', blockers: '', tomorrow: '', status: 'draft', updatedAt: 0,
});

/** "05:30" → "5:30 AM" */
export function clock(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export const slot = (e: EodEntry) => (e.start ? `${clock(e.start)}${e.end ? `–${clock(e.end)}` : ''}` : '');

export function minutes(e: EodEntry) {
  const p = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  const d = p(e.end) - p(e.start);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Plain text of a report, for copying and for asking the CW Assistant about it. */
export function reportText(r: EodReport, name: string) {
  const lines = [`EOD report · ${name} · ${longDate(r.date)}`, ''];
  for (const e of r.entries) {
    lines.push(`${slot(e) || '(no time)'} | ${e.task}${e.daily ? ' [daily]' : ''}`);
    for (const n of e.notes.split('\n').filter((l) => l.trim())) lines.push(`   ${n.trim()}`);
  }
  if (r.highlights.trim()) lines.push('', `Highlights: ${r.highlights.trim()}`);
  if (r.blockers.trim()) lines.push('', `Blockers / needs help: ${r.blockers.trim()}`);
  if (r.tomorrow.trim()) lines.push('', `Plan for tomorrow: ${r.tomorrow.trim()}`);
  return lines.join('\n');
}

/** The chat takes up to 4,000 characters, so long reports send shorter notes (then none) to fit. */
export const PROMPT_MAX = 3900;

/** The prompt for "Find automation ideas": the report plus what we want back. */
export function automationPrompt(r: EodReport, name: string) {
  const ask = `Here is ${name}'s EOD report. Find the tasks that look repetitive or rule-based and could be automated or sped up with Claude, Zapier, Keap or Google Sheets. Tasks marked [daily] are ones they do every day. For each opportunity give: the task, why it's a good candidate, a rough idea of how to automate it, the tools it needs, and an estimate of time saved per day. Rank them by impact, keep it short, and list any questions I should ask ${name.split(/\s+/)[0]} first.\n\n`;
  for (const cap of [Infinity, 240, 100, 0]) {
    const short = { ...r, entries: r.entries.map((e) => ({ ...e, notes: cap === Infinity ? e.notes : e.notes.slice(0, cap) })) };
    const text = ask + reportText(short, name);
    if (text.length <= PROMPT_MAX) return text;
  }
  return (ask + reportText({ ...r, entries: r.entries.map((e) => ({ ...e, notes: '' })) }, name)).slice(0, PROMPT_MAX);
}
