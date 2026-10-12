// For questions about Zaps or recent activity, attach the latest updates Zaps sent to the hub.

import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { listFeed } from '@/lib/integrations/zapier-feed';

const WORDS = /\b(zaps?|zapier|automations? (ran|failed|errors?)|recent (updates|activity)|latest (updates|activity))\b/i;
const MAX = 15;

export async function zapierContext(user: Person, message: string): Promise<string> {
  if (!isSuperAdmin(user) || !WORDS.test(message)) return '';
  const feed = (await listFeed().catch(() => [])).slice(0, MAX);
  const lines = feed.map((e) => `- ${new Date(e.at).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${e.direction === 'in' ? 'from' : 'started'} ${e.zap}${e.event ? ` · ${e.event}` : ''}${e.summary ? ` · ${e.summary}` : ''}`);
  return `\n\nFROM ZAPIER (latest updates Zaps sent to the hub, newest first):\n${lines.join('\n') || '- none yet'}`;
}
