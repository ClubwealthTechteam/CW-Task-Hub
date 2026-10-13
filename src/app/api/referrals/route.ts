// Referral Prospecting board: opportunities, the batches being read, and the member directory from Keap.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapConfigured } from '@/lib/integrations/keap/client';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { canUseWelcome as canUseReferrals } from '@/lib/welcome/access';
import { syncMembers } from '@/lib/referrals/members';
import { collectBatches } from '@/lib/referrals/finder';
import { getReferralSettings, listBatches, listOpps, memberNotes } from '@/lib/referrals/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseReferrals(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const settings = await getReferralSettings();
  let directory = { members: [] as Awaited<ReturnType<typeof syncMembers>>['members'], total: 0, pending: 0 };
  let error: string | undefined;
  if (keapConfigured()) {
    try { directory = await syncMembers(settings, new URL(req.url).searchParams.has('sync')); } catch (e) { error = keapMessage(e as IntegrationError); }
  }
  await collectBatches(new Set(directory.members.map((m) => m.id)));
  const [opps, batches, notes] = await Promise.all([listOpps(), listBatches(), memberNotes()]);
  return NextResponse.json({ keap: keapConfigured(), settings, opps, batches: batches.slice(0, 10), notes, ...directory, error });
}
