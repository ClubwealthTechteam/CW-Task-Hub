// The clean-ups the Database Secretary may propose. Each one touches only the hub's own data (never Keap or
// any other system) and runs only when a super admin presses Apply on the Council page.

import { deleteKey, getJSON, scanKeys } from '@/lib/store';
import type { Conversation } from '@/lib/chat/store';
import { listPosts, deletePost } from '@/lib/calendar';
import { listBatches, listOpps, saveBatches, saveOpps } from '@/lib/referrals/store';
import type { ActionId } from './agents';

const DAY = 86_400_000;

export async function applyAction(action: ActionId): Promise<string> {
  const now = Date.now();
  switch (action) {
    case 'remove-closed-referrals': {
      const opps = await listOpps();
      const keep = opps.filter((o) => !(o.status === 'closed' && (o.updated ?? o.at) < now - 60 * DAY));
      await saveOpps(keep);
      return `Removed ${opps.length - keep.length} closed referral${opps.length - keep.length === 1 ? '' : 's'}.`;
    }
    case 'remove-old-background-chats': {
      let n = 0;
      for (const k of await scanKeys('chat:conv:*', 3000)) {
        const c = await getJSON<Conversation | null>(k.key, null);
        if (c?.background && c.updated < now - 30 * DAY) { await deleteKey(k.key); n++; }
      }
      return `Deleted ${n} old background chat${n === 1 ? '' : 's'}.`;
    }
    case 'dedupe-calendar': {
      const seen = new Set<string>();
      let n = 0;
      // Oldest first, so the original stays and later copies go.
      for (const p of [...(await listPosts('social-media'))].reverse()) {
        const k = `${p.title.toLowerCase()}|${p.date}|${p.time ?? ''}|${p.repeat}`;
        if (seen.has(k)) { await deletePost('social-media', p.id); n++; } else seen.add(k);
      }
      return `Removed ${n} duplicate calendar post${n === 1 ? '' : 's'}.`;
    }
    case 'clear-failed-batches': {
      const b = await listBatches();
      const keep = b.filter((x) => !(x.status === 'error' && x.at < now - 7 * DAY));
      await saveBatches(keep);
      return `Cleared ${b.length - keep.length} failed batch${b.length - keep.length === 1 ? '' : 'es'}.`;
    }
  }
}
