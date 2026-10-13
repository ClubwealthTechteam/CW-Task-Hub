// Referral Prospecting board: opportunities, the batches being read, and the member directory from Keap.

import { NextResponse } from 'next/server';
import { getCurrentUser, getViewer } from '@/lib/auth/current-user';
import { allTags, candidates, claudePick, startClaudePick } from '@/lib/integrations/keap/tag-suggest';
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
  let memberSource: { by: 'claude' | 'tag'; status?: string; tags: string[]; why?: string } = { by: 'tag', tags: settings.tagNames };
  if (keapConfigured()) {
    try {
      let effective = settings;
      if (settings.find !== 'tag') {
        // Claude works out which Keap tag marks current members (asked again once a day).
        const tags = await allTags();
        let pick = await claudePick('member', new Set(tags.map((t) => t.id)));
        if (!(await getViewer())?.preview && (!pick || (pick.status !== 'thinking' && Date.now() - pick.at > 86_400_000))) pick = await startClaudePick(user, 'member', await candidates('member'));
        const chosen = (pick?.picks ?? []).map((p) => tags.find((t) => t.id === p.id)).filter(Boolean) as { id: number; name: string }[];
        effective = { ...settings, tagIds: chosen.map((t) => t.id), tagNames: chosen.map((t) => t.name) };
        memberSource = { by: 'claude', status: pick?.status, tags: effective.tagNames, why: pick?.picks?.[0]?.why };
      }
      directory = await syncMembers(effective, new URL(req.url).searchParams.has('sync'));
    } catch (e) { error = keapMessage(e as IntegrationError); }
  }
  await collectBatches(new Set(directory.members.map((m) => m.id)));
  const [opps, batches, notes] = await Promise.all([listOpps(), listBatches(), memberNotes()]);
  return NextResponse.json({ keap: keapConfigured(), settings, opps, batches: batches.slice(0, 10), notes, ...directory, memberSource, error });
}
