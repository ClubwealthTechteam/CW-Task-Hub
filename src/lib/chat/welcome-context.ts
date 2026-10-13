// For the New Client Welcome Posts task, give the assistant the clients waiting for a welcome post.

import { newClients } from '@/lib/welcome/keap-clients';
import { getSettings, listRecords } from '@/lib/welcome/store';
import { keapConfigured } from '@/lib/integrations/keap/client';

export async function welcomeContext(taskId: string | undefined): Promise<string> {
  if (taskId !== 'jaymar-1' || !keapConfigured()) return '';
  const settings = await getSettings();
  if (!settings.tagIds.length) return '';
  const [clients, records] = await Promise.all([newClients(settings), listRecords()]);
  const lines = clients.slice(0, 30).map((c) => {
    const r = records[c.contactId];
    const facts = [r?.business ?? c.business, r?.city ?? c.city, (r?.coach ?? c.coach) && `coach ${r?.coach ?? c.coach}`].filter(Boolean).join(' · ');
    return `- ${c.signedUp.slice(0, 10)} · ${c.first} ${c.last}${facts ? ` · ${facts}` : ''} · ${r?.status ?? 'new'}${r?.photoFileId ? ' · has photo' : r?.noPhoto ? ' · no-photo version' : ''}`;
  });
  return lines.length
    ? `\n\nNEW CLIENTS FOR WELCOME POSTS (from Keap, read-only; signed up · name · business · city · coach · status):\n${lines.join('\n')}`
    : '\n\nNEW CLIENTS FOR WELCOME POSTS: none in the chosen period.';
}
