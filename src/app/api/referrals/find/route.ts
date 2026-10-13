// Send pasted Facebook Group posts (and screenshots) to the assistant to find referral opportunities.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseWelcome as canUseReferrals } from '@/lib/welcome/access';
import { chatIsConfigured } from '@/lib/chat/routine';
import { storeIsPersistent } from '@/lib/store';
import { cachedMembers } from '@/lib/referrals/members';
import { startBatch } from '@/lib/referrals/finder';
import { getReferralSettings } from '@/lib/referrals/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseReferrals(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!chatIsConfigured() || !storeIsPersistent()) return NextResponse.json({ error: 'The assistant isn’t switched on yet' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? '').trim().slice(0, 20_000);
  const fileIds = Array.isArray(b.fileIds) ? b.fileIds.map(String).slice(0, 5) : [];
  if (!text && !fileIds.length) return NextResponse.json({ error: 'Paste at least one post or attach a screenshot' }, { status: 400 });
  const link = String(b.link ?? '').trim();
  const settings = await getReferralSettings();
  const ids = new Set<number>();
  const members = (await cachedMembers()).filter((m) => (ids.has(m.id) ? false : ids.add(m.id)));
  const batch = await startBatch(user, { text, group: String(b.group ?? '').trim().slice(0, 120) || undefined, link: /^https:\/\//.test(link) ? link.slice(0, 500) : undefined, fileIds }, members, settings);
  return NextResponse.json({ batch });
}
