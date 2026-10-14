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

/** Like setJSON, but the value expires after `seconds` (memory fallback: kept until restart). */
export async function setJSONFor(key: string, value: unknown, seconds: number) {
  const raw = JSON.stringify(value);
  if (storeIsPersistent()) await redis(['SET', key, raw, 'EX', seconds]);
  else memory.set(key, raw);
}

export async function deleteKey(key: string) {
  if (storeIsPersistent()) await redis(['DEL', key]);
  else memory.delete(key);
}

/** Keys matching a pattern like "chat:conv:*", with their size in bytes (for the council's data inventory). */
export async function scanKeys(pattern: string, max = 5000): Promise<{ key: string; bytes: number }[]> {
  const out: { key: string; bytes: number }[] = [];
  if (!storeIsPersistent()) {
    const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    for (const [k, v] of memory) if (re.test(k)) out.push({ key: k, bytes: v.length });
    return out.slice(0, max);
  }
  let cursor = '0';
  do {
    const [next, keys] = (await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 500])) as [string, string[]];
    cursor = String(next);
    for (const k of keys) out.push({ key: k, bytes: Number(await redis(['STRLEN', k])) || 0 });
  } while (cursor !== '0' && out.length < max);
  return out.slice(0, max);
}

/**
 * Remembers a slow answer (usually from Keap) for `seconds`, shared by every server instance, so a fresh
 * instance doesn't have to ask Keap again. Falls back to calling `load` when nothing is saved yet.
 */
const local = new Map<string, { until: number; value: unknown }>();
export async function cached<T>(key: string, seconds: number, load: () => Promise<T>): Promise<T> {
  const hit = local.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const saved = await getJSON<{ until: number; value: T } | null>(`cache:${key}`, null).catch(() => null);
  if (saved && saved.until > Date.now()) { local.set(key, saved); return saved.value; }
  const value = await load();
  const entry = { until: Date.now() + seconds * 1000, value };
  local.set(key, entry);
  await setJSONFor(`cache:${key}`, entry, seconds).catch(() => null);
  return value;
}
export async function forget(key: string) {
  local.delete(key);
  await deleteKey(`cache:${key}`).catch(() => null);
}

/**
 * Every key and its stored text, for the nightly backup. Uses SCAN + MGET in batches. `skip` drops keys
 * (secrets, caches, uploaded files) before their values are read.
 */
export async function dumpAll(skip: (key: string) => boolean): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!storeIsPersistent()) {
    for (const [k, v] of memory) if (!skip(k)) out[k] = v;
    return out;
  }
  let cursor = '0';
  do {
    const [next, keys] = (await redis(['SCAN', cursor, 'COUNT', 500])) as [string, string[]];
    cursor = String(next);
    const keep = keys.filter((k) => !skip(k));
    for (let i = 0; i < keep.length; i += 100) {
      const batch = keep.slice(i, i + 100);
      const values = (await redis(['MGET', ...batch])) as (string | null)[];
      batch.forEach((k, j) => { if (values[j] != null) out[k] = values[j] as string; });
    }
  } while (cursor !== '0');
  return out;
}
