// Referral settings: which Keap tag marks a Club Wealth member, an optional industry field, and how the
// SMS is signed. GET ?q= searches Keap tags; GET ?fields=1 lists custom fields.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { canUseWelcome as canUseReferrals } from '@/lib/welcome/access';
import { customFields, findTags } from '@/lib/welcome/keap-clients';
import { clearMemberDetails } from '@/lib/referrals/members';
import { getReferralSettings, saveReferralSettings, type ReferralSettings } from '@/lib/referrals/store';

export const dynamic = 'force-dynamic';

async function allowed() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseReferrals(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

export async function GET(req: Request) {
  const denied = await allowed();
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  try {
    if (q.has('fields')) return NextResponse.json({ fields: await customFields() });
    if (q.get('q')) return NextResponse.json({ tags: await findTags(String(q.get('q')).slice(0, 60)) });
    return NextResponse.json({ settings: await getReferralSettings() });
  } catch (e) {
    return NextResponse.json({ error: keapMessage(e as IntegrationError) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const denied = await allowed();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const before = await getReferralSettings();
  const tags: { id: number; name: string }[] = Array.isArray(b.tags) ? b.tags.filter((t: { id: unknown }) => Number.isInteger(Number(t?.id))).slice(0, 5) : [];
  const industryField = Number.isInteger(Number(b.industryField)) && Number(b.industryField) > 0 ? Number(b.industryField) : undefined;
  const settings: ReferralSettings = {
    find: b.find === 'tag' ? 'tag' : 'claude',
    tagIds: tags.map((t) => Number(t.id)),
    tagNames: tags.map((t) => String(t.name ?? t.id).slice(0, 80)),
    industryField,
    industryLabel: industryField ? String(b.industryLabel ?? '').slice(0, 80) : undefined,
    sender: String(b.sender ?? '').trim().slice(0, 60) || 'Jay from Club Wealth',
  };
  await saveReferralSettings(settings);
  if (before.industryField !== settings.industryField) await clearMemberDetails();
  return NextResponse.json({ settings });
}
