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
  /** "How many tasks have you completed?", answered by the person (not the number of rows). */
  tasksCompleted?: number | null;
  status: 'draft' | 'submitted';
  submittedAt?: number;
  updatedAt: number;
  edited?: boolean;  // changed after it was submitted
}

export const LIMITS = { entries: 60, task: 300, notes: 2000, text: 2000 };

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
  if (r.tasksCompleted != null) lines.push('', `Tasks completed: ${r.tasksCompleted}`);
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

// ───────────── Paste from an EOD sheet or email ─────────────
// People keep their own EOD sheet (a Time column and one column per day) or the emailed PDS layout
// (a "5:30–6:00 AM" line, then tasks, with "- " lines as notes). Pasting either turns into rows.

export interface PastedRow { start: string; end: string; task: string; notes: string }
export interface PasteResult { rows: PastedRow[]; columns: string[]; column: number }

const ONE_TIME = /^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i;
const RANGE = /^(\d{1,2}):(\d{2})\s*([ap]\.?\s*m\.?)?\s*[–—-]\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i;
const SKIP = /^(task|tasks|notes?|time|task\s+notes?|week of:?.*|\d{4}[./-]\d{2}[./-]\d{2}|end of shift)$/i;

const to24 = (h: number, m: number, pm: boolean) => `${String((h % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const plus30 = (t: string) => { const [h, m] = t.split(':').map(Number); const v = Math.min(23 * 60 + 59, h * 60 + m + 30); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

function oneTime(s: string) {
  const m = ONE_TIME.exec(s.trim());
  return m ? to24(Number(m[1]), Number(m[2]), m[3].toLowerCase() === 'p') : '';
}
function range(s: string): [string, string] | null {
  const m = RANGE.exec(s.trim());
  if (!m) return null;
  const endPm = m[6].toLowerCase() === 'p';
  const end = to24(Number(m[4]), Number(m[5]), endPm);
  let start = to24(Number(m[1]), Number(m[2]), m[3] ? m[3].toLowerCase().startsWith('p') : endPm);
  if (!m[3] && start > end) start = to24(Number(m[1]), Number(m[2]), false); // "11:30–12:00 PM"
  return [start, end];
}

/** A sheet line stays whole as the task; only a very long one spills its later sentences into notes. */
function split(text: string): { task: string; notes: string } {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= LIMITS.task) return { task: t, notes: '' };
  const head = t.slice(0, LIMITS.task);
  const cut = Math.max(head.lastIndexOf('; '), head.lastIndexOf('. '));
  const at = cut > 40 ? cut + 1 : head.lastIndexOf(' ');
  return { task: t.slice(0, at).trim(), notes: t.slice(at + 1).trim() };
}

export function parsePasted(raw: string, pick?: number): PasteResult {
  const lines = raw.replace(/\r/g, '').split('\n');
  if (lines.some((l) => l.includes('\t'))) {
    // Sheet: find the time column, then the day column(s) beside it.
    const cells = lines.map((l) => l.split('\t').map((c) => c.trim()));
    const width = Math.max(...cells.map((r) => r.length));
    const score = (i: number) => cells.filter((r) => oneTime(r[i] ?? '')).length;
    let timeCol = 0;
    for (let i = 1; i < width; i++) if (score(i) > score(timeCol)) timeCol = i;
    const header = cells.find((r) => /^time$/i.test(r[timeCol] ?? ''));
    const textCols = [...Array(width).keys()].filter((i) => i !== timeCol && cells.some((r) => oneTime(r[timeCol] ?? '') && (r[i] ?? '')));
    const columns = textCols.map((i, n) => header?.[i] || `Column ${n + 1}`);
    const column = pick != null && pick < textCols.length ? pick : textCols.length - 1;
    const col = textCols[column];
    const timed = cells.filter((r) => oneTime(r[timeCol] ?? ''));
    const rows: PastedRow[] = [];
    timed.forEach((r, i) => {
      const text = col == null ? '' : (r[col] ?? '');
      if (!text || SKIP.test(text) || columns.includes(text)) return;
      const start = oneTime(r[timeCol]);
      // Each sheet row is a slot: it ends at the next row's time (an hour at most), else after 30 minutes.
      const next = timed[i + 1] ? oneTime(timed[i + 1][timeCol]) : '';
      const s = split(text);
      rows.push({ start, end: next > start && next <= plus30(plus30(start)) ? next : plus30(start), task: s.task, notes: s.notes });
    });
    if (score(timeCol) === 0) {
      // No times at all: every non-empty cell in the last column is a task.
      for (const r of cells) { const t = (r[r.length - 1] ?? '').trim(); if (t && !SKIP.test(t)) rows.push({ start: '', end: '', ...split(t) }); }
    }
    return { rows, columns, column };
  }

  // Email / plain text: time lines set the slot, "- " lines are notes for the task above.
  const rows: PastedRow[] = [];
  let start = '', end = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t || SKIP.test(t)) continue;
    const r = range(t);
    if (r) { [start, end] = r; continue; }
    const one = oneTime(t);
    if (one) { start = one; end = plus30(one); continue; }
    const last = rows.at(-1);
    if (/^[-–•*]/.test(t) && last) { last.notes = [last.notes, t.replace(/^[-–•*]+\s*/, '')].filter(Boolean).join('\n'); continue; }
    rows.push({ start, end, ...split(t) });
  }
  return { rows, columns: [], column: 0 };
}
