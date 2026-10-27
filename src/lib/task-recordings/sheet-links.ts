// Spreadsheet links for a write-up's Google Sheets steps. A screen recording only shows the sheet's name and
// tab, and the address bar is often cut off, so each step is matched against the hub's Sheets list (the
// sheets kept in the marketing Gmail, marketingclubwealth@gmail.com, or an approved account) by link or name,
// then pointed at the exact tab (#gid=…) when the hub's Google service account can read that sheet.

import { accountAllowed, listSheets, sheetIdFromUrl, type SheetEntry } from '@/lib/sheets';
import { sheetTabs, sheetsConfigured } from '@/lib/integrations/google/sheets';
import type { WriteUp } from './store';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The hub's known spreadsheets, one per sheet (from allowed accounts only). */
export async function knownSheets(): Promise<SheetEntry[]> {
  const seen = new Set<string>();
  const out: SheetEntry[] = [];
  for (const s of await listSheets()) {
    if (seen.has(s.sheetId) || !(await accountAllowed(s.account))) continue;
    seen.add(s.sheetId);
    out.push(s);
  }
  return out;
}

/** The known sheet with this name: an exact match, else the only one whose name contains it (or it contains). */
function byName(sheets: SheetEntry[], name: string): SheetEntry | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = sheets.filter((s) => norm(s.name) === n);
  if (exact.length === 1) return exact[0];
  const near = sheets.filter((s) => norm(s.name).includes(n) || n.includes(norm(s.name)));
  return near.length === 1 ? near[0] : undefined;
}

/** Fills in or corrects each Sheets step's link (spreadsheet + tab) from the hub's Sheets list. Never throws. */
export async function fillSheetLinks(w: WriteUp): Promise<WriteUp> {
  const sheets = await knownSheets().catch(() => [] as SheetEntry[]);
  const tabsOf = new Map<string, Promise<{ title: string; gid: number }[]>>();
  const tabs = (id: string) => {
    if (!tabsOf.has(id)) tabsOf.set(id, sheetsConfigured() ? sheetTabs(id).then((x) => x.tabs).catch(() => []) : Promise.resolve([]));
    return tabsOf.get(id)!;
  };
  const steps = await Promise.all(w.steps.map(async (s) => {
    if (s.app !== 'sheets' && !s.sheet) return s;
    const fromLink = sheetIdFromUrl(s.link);
    const known = (fromLink && sheets.find((x) => x.sheetId === fromLink)) || byName(sheets, s.sheet);
    const id = fromLink ?? known?.sheetId;
    if (!id) return s;
    const tab = s.tab ? (await tabs(id)).find((t) => norm(t.title) === norm(s.tab)) : undefined;
    const keep = fromLink === id && /[#?&]gid=\d+/.test(s.link);
    const link = tab ? `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${tab.gid}` : keep ? s.link : `https://docs.google.com/spreadsheets/d/${id}/edit`;
    return { ...s, link, sheet: s.sheet || known?.name || '', tab: tab?.title ?? s.tab };
  }));
  return { ...w, steps };
}
