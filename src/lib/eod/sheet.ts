// Copies submitted EOD reports to the EOD Report Submissions Google Sheet: one tab per person (one row per
// task, newest report first) and an "All submissions" tab (one row per report). Each sync rewrites the
// person's tab and the summary from the hub's data, so edits and re-submits never leave duplicates.

import { personById, type Person } from '@/config/people';
import { DEPARTMENTS } from '@/config/departments';
import { getJSON, setJSON } from '@/lib/store';
import { EOD_SHEET_ID, addTab, replaceRows, tabsOf } from '@/lib/integrations/google/sheets-write';
import { sheetsConfigured } from '@/lib/integrations/google/sheets';
import { reportsOf, submittedFeed } from './store';
import { minutes, slot, type EodReport } from './report';

export const EOD_SHEET_URL = `https://docs.google.com/spreadsheets/d/${EOD_SHEET_ID}/edit`;
const SUMMARY = 'All submissions';
const PERSON_HEADER = ['Date', 'Time', 'Task', 'Notes', 'Daily', 'Highlights', 'Blockers / needs help', 'Plan for tomorrow', 'Submitted (PT)', 'Edited'];
const STATUS_KEY = 'eod:sheet:status';

// Tab names as they appear in the sheet (first names; Jay Mar keeps both).
const TAB: Record<string, string> = { ali: 'Ali', jowee: 'Jowee', jaymar: 'Jay Mar', jp: 'JP', miguel: 'Miguel', omerson: 'Omerson', camille: 'Camille' };
export const tabFor = (p: Person) => TAB[p.id] ?? p.name.split(/\s+/)[0];

const when = (at?: number) => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '');
const hours = (r: EodReport) => Math.round((r.entries.reduce((s, e) => s + minutes(e), 0) / 60) * 100) / 100;

function personRows(reports: EodReport[]) {
  const rows: (string | number)[][] = [];
  for (const r of reports) {
    r.entries.forEach((e, i) => rows.push([
      r.date, slot(e), e.task, e.notes, e.daily ? 'Yes' : '',
      i === 0 ? r.highlights : '', i === 0 ? r.blockers : '', i === 0 ? r.tomorrow : '',
      i === 0 ? when(r.submittedAt) : '', i === 0 && r.edited ? 'Yes' : '',
    ]));
  }
  return rows;
}

function summaryRow(r: EodReport): (string | number)[] {
  const p = personById(r.uid);
  return [
    r.date, p?.name ?? r.uid, DEPARTMENTS.find((d) => d.id === p?.departments[0])?.name ?? '',
    r.entries.length, hours(r), r.entries.filter((e) => e.daily).map((e) => e.task).join('\n'),
    r.highlights, r.blockers, r.tomorrow, when(r.submittedAt), r.edited ? 'Yes' : '',
  ];
}

export interface SheetStatus { ok: boolean; at: number; error?: string }
export const sheetStatus = () => getJSON<SheetStatus | null>(STATUS_KEY, null);

/** Rewrites this person's tab and the summary tab. Never throws: the result is kept for the EOD page. */
export async function syncEodSheet(uid: string): Promise<SheetStatus> {
  const person = personById(uid);
  let status: SheetStatus;
  try {
    if (!person) throw new Error('Unknown person');
    if (!sheetsConfigured()) throw new Error('Google Sheets is not connected (GOOGLE_SERVICE_ACCOUNT_JSON)');
    const tab = tabFor(person);
    const tabs = await tabsOf(EOD_SHEET_ID);
    if (!tabs.includes(tab)) await addTab(EOD_SHEET_ID, tab, PERSON_HEADER, tabs.find((t) => t !== SUMMARY));
    const mine = (await reportsOf(uid)).filter((r) => r.status === 'submitted');
    await replaceRows(EOD_SHEET_ID, tab, personRows(mine));
    await replaceRows(EOD_SHEET_ID, SUMMARY, (await submittedFeed(1000)).sort((a, b) => b.date.localeCompare(a.date) || (b.submittedAt ?? 0) - (a.submittedAt ?? 0)).map(summaryRow));
    status = { ok: true, at: Date.now() };
  } catch (e) {
    status = { ok: false, at: Date.now(), error: e instanceof Error ? e.message : String(e) };
    console.error('eod sheet sync:', status.error);
  }
  await setJSON(STATUS_KEY, status).catch(() => null);
  return status;
}
