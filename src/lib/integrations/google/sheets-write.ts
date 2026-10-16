// Writing to Google Sheets. Only the sheets listed here can be written, and only once they're shared with
// the hub's service account as Editor. Values are written RAW, so text someone types (even "=...") is
// never run as a formula.

import { IntegrationError } from '../http';
import { accessToken, serviceAccountEmail } from './sheets';

export const EOD_SHEET_ID = process.env.EOD_SHEET_ID || '1P2ass3eLOHfe-qtdkzCVuG09y96iKb7K-Ditt3sULw4';
const WRITABLE = new Set([EOD_SHEET_ID]);

async function call(sheetId: string, path: string, init: RequestInit = {}) {
  if (!WRITABLE.has(sheetId)) throw new IntegrationError('The hub may not write to this sheet', 403);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken('write')}`, 'Content-Type': 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403 || res.status === 404) {
    throw new IntegrationError(`The sheet isn't shared with the hub as Editor yet. Share it with ${serviceAccountEmail()} as Editor.`, 403);
  }
  if (!res.ok) throw new IntegrationError(`Google Sheets write failed (${res.status})`, res.status, body);
  return body;
}

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/** Tab titles in the sheet. */
export async function tabsOf(sheetId: string): Promise<string[]> {
  const body = await call(sheetId, '?fields=sheets.properties.title');
  return (body.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
}

/** Adds a tab (copying the look of `template` when given) with this header row. */
export async function addTab(sheetId: string, title: string, header: string[], template?: string) {
  const meta = await call(sheetId, '?fields=sheets.properties(sheetId,title)');
  const src = (meta.sheets ?? []).find((s: { properties: { title: string } }) => s.properties.title === template)?.properties.sheetId;
  await call(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [src != null
      ? { duplicateSheet: { sourceSheetId: src, newSheetName: title } }
      : { addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }] }),
  });
  await replaceRows(sheetId, title, [header], 1);
}

/** Replaces everything from `fromRow` down with these rows (clears first, so shorter data leaves no leftovers). */
export async function replaceRows(sheetId: string, tab: string, rows: (string | number)[][], fromRow = 2) {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const lastCol = String.fromCharCode(64 + Math.min(26, width));
  await call(sheetId, '/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges: [`${quote(tab)}!A${fromRow}:Z`] }) });
  if (!rows.length) return;
  await call(sheetId, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: `${quote(tab)}!A${fromRow}:${lastCol}${fromRow + rows.length - 1}`, values: rows }] }),
  });
}
