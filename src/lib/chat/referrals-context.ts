// For the Referral Prospecting task, give the assistant the open opportunities and who they're matched to.

import { listOpps } from '@/lib/referrals/store';
import { cachedMembers } from '@/lib/referrals/members';

export async function referralsContext(taskId: string | undefined): Promise<string> {
  if (taskId !== 'jaymar-8') return '';
  const [opps, members] = await Promise.all([listOpps(), cachedMembers()]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const open = opps.filter((o) => o.status === 'new' || o.status === 'texted').slice(0, 40);
  if (!open.length) return '\n\nREFERRAL OPPORTUNITIES: none open.';
  return `\n\nREFERRAL OPPORTUNITIES (open; location · need · matched member · status):\n${open.map((o) => {
    const m = o.memberId ? byId.get(o.memberId) : undefined;
    return `- ${[o.city, o.state].filter(Boolean).join(', ') || '?'} · ${o.need}${o.group ? ` (${o.group})` : ''} · ${m ? `${m.name}${m.business ? `, ${m.business}` : ''}` : 'no member yet'} · ${o.status}`;
  }).join('\n')}`;
}
