// Restores a nightly backup into the hub's storage (Upstash Redis).
//   KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/restore-backup.mjs backup.json[.gz] [--only=chat:conv:]
// Writes every key in the backup (or only keys starting with --only). Keys not in the backup are left alone.
// Run it with care: it overwrites the current value of each key it writes.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const file = process.argv[2];
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!file || !url || !token) { console.error('Usage: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/restore-backup.mjs backup.json.gz [--only=prefix]'); process.exit(1); }

const raw = readFileSync(file);
const backup = JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
const entries = Object.entries(backup.data).filter(([k]) => !only || k.startsWith(only));
console.log(`Backup from ${backup.at}: restoring ${entries.length} of ${backup.keys} keys${only ? ` (prefix ${only})` : ''}`);
let done = 0;
for (const [key, value] of entries) {
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['SET', key, value]) });
  if (!res.ok) { console.error(`Failed on ${key}: HTTP ${res.status}`); process.exit(1); }
  if (++done % 100 === 0) console.log(`${done}…`);
}
console.log(`Restored ${done} keys.`);
