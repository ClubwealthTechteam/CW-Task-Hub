// The spreadsheets each person uses for their tasks. Every sheet must live in the marketing Gmail
// (SHEETS_ACCOUNT, default marketingclubwealth@gmail.com: the account Zapier's Google Sheets connection uses)
// or in another account a super admin approved.

import { getJSON, setJSON } from '@/lib/store';

export interface SheetEntry {
  id: string;
  owner: string;          // hub person id who added it
  name: string;
  url: string;
  sheetId: string;
  account: string;        // Google account the sheet lives in
  taskIds: string[];
  note?: string;
  added: number;
}

export interface ApprovedAccount { email: string; note?: string; by: string; at: number }

const SHEETS = 'sheets:all';
const APPROVED = 'sheets:approved-accounts';

export const mainAccount = () => (process.env.SHEETS_ACCOUNT || 'marketingclubwealth@gmail.com').trim().toLowerCase();

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const isMainAccount = (email: string) => normalizeEmail(email) === mainAccount();

/** The spreadsheet id from a Google Sheets link, or null if it isn't one. */
export function sheetIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com') return null;
    return u.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export const listSheets = () => getJSON<SheetEntry[]>(SHEETS, []);
export const saveSheets = (all: SheetEntry[]) => setJSON(SHEETS, all);
export const listApproved = () => getJSON<ApprovedAccount[]>(APPROVED, []);
export const saveApproved = (all: ApprovedAccount[]) => setJSON(APPROVED, all);

export async function accountAllowed(email: string) {
  if (isMainAccount(email)) return true;
  const e = normalizeEmail(email);
  return (await listApproved()).some((a) => a.email === e);
}
