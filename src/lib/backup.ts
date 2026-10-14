// The nightly backup of the hub's data (chats, lists, referrals, calendar, call notes, settings...).
// Left out on purpose: secrets (Canva sign-ins, custom integration keys), caches, sign-in lockouts and
// uploaded chat files (they expire on their own and are large).

import { dumpAll } from '@/lib/store';

const SKIP = [/^cache:/, /^canva:/, /^login:fails:/, /^chat:file:/, /^health:ping$/];

export async function backup() {
  const data = await dumpAll((k) => SKIP.some((re) => re.test(k)));
  // Custom integrations keep their key inside the record: strip it.
  if (data['integrations:custom']) {
    try {
      const list = JSON.parse(data['integrations:custom']) as Record<string, unknown>[];
      data['integrations:custom'] = JSON.stringify(list.map(({ secret: _secret, ...rest }) => ({ ...rest, secret: _secret ? '(removed from backup)' : undefined })));
    } catch { delete data['integrations:custom']; }
  }
  return { app: 'cw-task-hub', at: new Date().toISOString(), keys: Object.keys(data).length, data };
}
