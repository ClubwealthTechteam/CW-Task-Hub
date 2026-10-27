// Google Sheets, read-only, through a Google service account (GOOGLE_SERVICE_ACCOUNT_JSON: the key file's JSON,
// or the same base64-encoded). A sheet is readable once it's shared with the service account's email as Viewer.
// Reads use the spreadsheets.readonly scope. The one exception is sheets-write.ts, which writes only to
// the sheets on its allow-list (the EOD report sheet), and only when they're shared with the hub as Editor.

import crypto from 'node:crypto';
import { IntegrationError } from '../http';

interface ServiceAccount { client_email: string; private_key: string }

function account(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  // Forgive common paste problems: wrapping quotes, the variable name pasted in front, or line breaks
  // inside the private key turned into real ones.
  let text = raw.replace(/^GOOGLE_SERVICE_ACCOUNT_JSON\s*=\s*/, '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8');
  const keyLines = text.replace(/("private_key"\s*:\s*")([\s\S]*?)(")/, (_m, a: string, k: string, b: string) => a + k.replace(/\r?\n/g, '\\n') + b);
  for (const t of [text, keyLines]) {
    try {
      const json = JSON.parse(t);
      if (json.client_email && json.private_key) return { ...json, private_key: String(json.private_key).replace(/\\n/g, '\n') };
    } catch { /* try the next form */ }
  }
  console.error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid');
  return null;
}

export const sheetsConfigured = () => Boolean(account());

/** For the health check: whether the key is missing, unreadable, or fine. Never the key itself. */
export const sheetsKeyState = () => (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ? 'missing' : account() ? 'ok' : 'invalid');
export const serviceAccountEmail = () => account()?.client_email ?? null;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const SCOPES = { read: 'https://www.googleapis.com/auth/spreadsheets.readonly', write: 'https://www.googleapis.com/auth/spreadsheets' };
const tokens: Partial<Record<keyof typeof SCOPES, { value: string; exp: number }>> = {};

export async function accessToken(kind: keyof typeof SCOPES = 'read') {
  const token = tokens[kind];
  if (token && token.exp - 60_000 > Date.now()) return token.value;
  const sa = account();
  if (!sa) throw new IntegrationError('Google Sheets is not connected yet. Add GOOGLE_SERVICE_ACCOUNT_JSON in Vercel.', 503);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPES[kind],
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new IntegrationError('Google rejected the service account key', 502, body);
  tokens[kind] = { value: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return tokens[kind]!.value;
}

async function get(path: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` }, cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403 || res.status === 404) {
    throw new IntegrationError(`This sheet isn't shared with the hub yet. Share it with ${serviceAccountEmail()} as Viewer.`, 403);
  }
  if (!res.ok) throw new IntegrationError(`Google Sheets request failed (${res.status})`, res.status, body);
  return body;
}

export interface SheetTab { title: string; rows: string[][] }
export interface SheetContent { title: string; tabs: SheetTab[]; truncated: boolean }

/** The sheet's title and its tab names (also a quick "can the hub read this?" check). */
export async function sheetInfo(sheetId: string) {
  const body = await get(`${encodeURIComponent(sheetId)}?fields=properties.title,sheets.properties.title`);
  return { title: String(body.properties?.title ?? ''), tabs: (body.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title) as string[] };
}

/** The sheet's title and each tab's name with its gid (the #gid=… in a link to that tab). */
export async function sheetTabs(sheetId: string) {
  const body = await get(`${encodeURIComponent(sheetId)}?fields=properties.title,sheets.properties(title,sheetId)`);
  return {
    title: String(body.properties?.title ?? ''),
    tabs: (body.sheets ?? []).map((s: { properties: { title: string; sheetId: number } }) => ({ title: s.properties.title, gid: s.properties.sheetId })) as { title: string; gid: number }[],
  };
}

/** The first rows of the first few tabs, as plain text values. */
export async function readSheet(sheetId: string, opts: { maxTabs?: number; maxRows?: number; maxCols?: number } = {}): Promise<SheetContent> {
  const { maxTabs = 3, maxRows = 60, maxCols = 15 } = opts;
  const info = await sheetInfo(sheetId);
  const tabs = info.tabs.slice(0, maxTabs);
  const lastCol = String.fromCharCode(64 + Math.min(maxCols, 26));
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!A1:${lastCol}${maxRows}`)}`).join('&');
  const body = tabs.length ? await get(`${encodeURIComponent(sheetId)}/values:batchGet?${ranges}&majorDimension=ROWS`) : { valueRanges: [] };
  return {
    title: info.title,
    tabs: tabs.map((t, i) => ({ title: t, rows: (body.valueRanges?.[i]?.values ?? []).map((r: unknown[]) => r.map((c) => String(c ?? ''))) })),
    truncated: info.tabs.length > maxTabs,
  };
}
