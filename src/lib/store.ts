// Small key-value store for things the app writes at runtime (custom integrations, run log).
// Uses Upstash Redis over REST when KV_REST_API_URL/TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) are set
// (Vercel → Storage → Upstash); otherwise falls back to memory, which resets whenever the server restarts.

const memory = new Map<string, string>();
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeIsPersistent = () => Boolean(url() && token());

async function redis(command: (string | number)[]) {
  const res = await fetch(url() as string, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Store error ${res.status}`);
  return (await res.json()).result;
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = storeIsPersistent() ? await redis(['GET', key]) : memory.get(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function setJSON(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  if (storeIsPersistent()) await redis(['SET', key, raw]);
  else memory.set(key, raw);
}
