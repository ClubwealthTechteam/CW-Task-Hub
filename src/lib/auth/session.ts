// Signed session cookie (HMAC-SHA256 with SESSION_SECRET). Uses Web Crypto so it works in both the
// middleware (edge) and server code. When CW University / Google sign-in is connected, only this
// file and the login route change: everything else reads the user from getCurrentUser().

export const SESSION_COOKIE = 'cwth_session';
export const SESSION_DAYS = 7;

export interface SessionPayload { uid: string; exp: number }

const enc = new TextEncoder();
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== 'production') return 'dev-only-insecure-secret';
  throw new Error('SESSION_SECRET is not set');
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Signs any short value with SESSION_SECRET (used for one-off tokens, e.g. chat reply tokens). */
export const signValue = (data: string) => hmac(data);

export async function signSession(uid: string) {
  const payload: SessionPayload = { uid, exp: Date.now() + SESSION_DAYS * 864e5 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    if ((await hmac(body)) !== sig) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Cookie settings. SameSite=None lets the hub keep people signed in when shown inside CW University. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: SESSION_DAYS * 86400,
};
