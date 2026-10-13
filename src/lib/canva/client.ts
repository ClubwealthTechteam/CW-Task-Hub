// Canva Connect (REST API), per person, through OAuth with PKCE. For now only Jay Mar uses it (CANVA_USERS),
// in the Marketing Graphics task. Tokens are kept encrypted in the hub's store and never reach the browser.
// The hub only creates designs (from a graphic or a PDF) and reads them; it never edits or deletes anything
// already in Canva.

import crypto from 'node:crypto';
import type { Person } from '@/config/people';
import { deleteKey, getJSON, setJSON, setJSONFor } from '@/lib/store';

const AUTHORIZE = 'https://www.canva.com/api/oauth/authorize';
const API = 'https://api.canva.com/rest/v1';
export const CANVA_SCOPES = 'asset:read asset:write design:content:read design:content:write design:meta:read profile:read';
export const CANVA_TASK = 'jaymar-6'; // Marketing Graphics
export const redirectUri = () => `${process.env.HUB_URL || 'https://cw-ai-task-hub.vercel.app'}/api/canva/callback`;

export const canvaConfigured = () => Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
const allowedIds = () => (process.env.CANVA_USERS || 'jaymar').split(',').map((s) => s.trim()).filter(Boolean);
export const canUseCanva = (user: Person | null | undefined) => Boolean(user) && allowedIds().includes(user!.id);

export class CanvaError extends Error { constructor(message: string, public status = 500) { super(message); } }

interface Tokens { access: string; refresh: string; expiresAt: number; name?: string; connectedAt: number }

// ---- encrypted token storage ----
const key = () => crypto.createHash('sha256').update(`canva-tokens:${process.env.SESSION_SECRET ?? ''}`).digest();
function seal(t: Tokens) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(t), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}
function open(s: string): Tokens | null {
  try {
    const [iv, tag, data] = s.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
  } catch { return null; }
}
const tokenKey = (uid: string) => `canva:token:${uid}`;
const loadTokens = async (uid: string) => { const s = await getJSON<string | null>(tokenKey(uid), null); return s ? open(s) : null; };
const saveTokens = (uid: string, t: Tokens) => setJSON(tokenKey(uid), seal(t));

// ---- OAuth ----
const b64url = (b: Buffer) => b.toString('base64url');

export async function authorizeUrl(uid: string, returnTo: string) {
  const verifier = b64url(crypto.randomBytes(64));
  const state = b64url(crypto.randomBytes(32));
  await setJSONFor(`canva:oauth:${state}`, { uid, verifier, returnTo }, 600);
  const q = new URLSearchParams({
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 's256', scope: CANVA_SCOPES, response_type: 'code',
    client_id: process.env.CANVA_CLIENT_ID as string, state, redirect_uri: redirectUri(),
  });
  return `${AUTHORIZE}?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new CanvaError(data.error_description || data.message || `Canva sign-in failed (${res.status})`, res.status);
  return { access: data.access_token as string, refresh: data.refresh_token as string, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
}

export async function finishAuth(uid: string, code: string, state: string) {
  const pending = await getJSON<{ uid: string; verifier: string; returnTo: string } | null>(`canva:oauth:${state}`, null);
  await deleteKey(`canva:oauth:${state}`);
  if (!pending || pending.uid !== uid) throw new CanvaError('This Canva sign-in link expired or belongs to someone else. Try connecting again.', 400);
  const t = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: pending.verifier, redirect_uri: redirectUri() });
  const tokens: Tokens = { ...t, connectedAt: Date.now() };
  await saveTokens(uid, tokens);
  tokens.name = await profileName(uid).catch(() => undefined);
  if (tokens.name) await saveTokens(uid, tokens);
  return pending.returnTo;
}

/** A valid access token, refreshed when it's about to expire (each refresh token works once). */
async function accessToken(uid: string, force = false) {
  const t = await loadTokens(uid);
  if (!t) throw new CanvaError('Canva isn’t connected', 409);
  if (!force && t.expiresAt - Date.now() > 60_000) return t.access;
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh }).catch((e) => {
    if (e.status === 400 || e.status === 401) throw new CanvaError('The Canva connection expired. Connect Canva again.', 409);
    throw e;
  });
  await saveTokens(uid, { ...t, ...fresh });
  return fresh.access;
}

async function api<T = Record<string, any>>(uid: string, path: string, init: RequestInit = {}, retried = false): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await accessToken(uid, retried)}` }, cache: 'no-store' });
  if (res.status === 401 && !retried) return api<T>(uid, path, init, true);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CanvaError(data.message || `Canva returned an error (${res.status})`, res.status);
  return data as T;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function poll<T>(get: () => Promise<{ job: T & { status: string; error?: { message?: string } } }>, seconds = 40) {
  for (let i = 0; i < seconds; i++) {
    const { job } = await get();
    if (job.status === 'success') return job;
    if (job.status === 'failed') throw new CanvaError(job.error?.message || 'Canva couldn’t finish it', 502);
    await wait(1000);
  }
  throw new CanvaError('Canva is taking long. Try again in a minute.', 504);
}

export async function profileName(uid: string) {
  const data = await api(uid, '/users/me/profile');
  return data?.profile?.display_name as string | undefined;
}

export async function status(uid: string) {
  const t = await loadTokens(uid);
  return t ? { connected: true, name: t.name, connectedAt: t.connectedAt } : { connected: false };
}

export async function disconnect(uid: string) {
  const t = await loadTokens(uid);
  await deleteKey(tokenKey(uid));
  if (t) {
    await fetch(`${API}/oauth/revoke`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: t.refresh }),
    }).catch(() => null);
  }
}

// ---- making designs ----
export interface CanvaDesign { id: string; title: string; editUrl: string; viewUrl: string; at: number }
const b64 = (s: string) => Buffer.from(s.slice(0, 50), 'utf8').toString('base64');
const design = (d: Record<string, any>, title: string): CanvaDesign => ({ id: d.id, title: d.title || title, editUrl: d.urls?.edit_url, viewUrl: d.urls?.view_url, at: Date.now() }); // eslint-disable-line @typescript-eslint/no-explicit-any

/** Width and height of a PNG or JPEG. */
export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i < bytes.length - 9;) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** A PNG/JPEG becomes a Canva design of the same size with the image in it. */
export async function designFromImage(uid: string, bytes: Buffer, title: string) {
  const up = await api(uid, '/asset-uploads', {
    method: 'POST', body: new Uint8Array(bytes),
    headers: { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': JSON.stringify({ name_base64: b64(title) }) },
  });
  const job = await poll(() => api(uid, `/asset-uploads/${up.job.id}`) as Promise<{ job: { status: string; asset?: { id: string } } }>);
  const size = imageSize(bytes) ?? { width: 1080, height: 1080 };
  const clamp = (n: number) => Math.max(40, Math.min(8000, n));
  const made = await api(uid, '/designs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'type_and_asset', design_type: { type: 'custom', width: clamp(size.width), height: clamp(size.height) }, asset_id: job.asset!.id, title: title.slice(0, 255) }),
  });
  return design(made.design, title);
}

/** A PDF becomes an editable Canva design (text stays text). */
export async function designFromPdf(uid: string, bytes: Buffer, title: string) {
  const imp = await api(uid, '/imports', {
    method: 'POST', body: new Uint8Array(bytes),
    headers: { 'Content-Type': 'application/octet-stream', 'Import-Metadata': JSON.stringify({ title_base64: b64(title), mime_type: 'application/pdf' }) },
  });
  const job = await poll(() => api(uid, `/imports/${imp.job.id}`) as Promise<{ job: { status: string; result?: { designs: Record<string, any>[] } } }>); // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = job.result?.designs?.[0];
  if (!d) throw new CanvaError('Canva didn’t return a design', 502);
  return design(d, title);
}
