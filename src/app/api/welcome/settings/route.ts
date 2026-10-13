// Settings for New Client Welcome Posts: which Keap tag marks a new client, how far back to look, and
// where the coach's name comes from. GET ?q= searches Keap tags; GET ?fields=1 lists custom fields.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { canUseWelcome } from '@/lib/welcome/access';
import { clearClientCache, customFields, findTags } from '@/lib/welcome/keap-clients';
import { getSettings, saveSettings, type WelcomeSettings } from '@/lib/welcome/store';

export const dynamic = 'force-dynamic';

async function allowed() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return null;
}

export async function GET(req: Request) {
  const denied = await allowed();
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  try {
    if (q.has('fields')) return NextResponse.json({ fields: await customFields() });
    if (q.get('q')) return NextResponse.json({ tags: await findTags(String(q.get('q')).slice(0, 60)) });
    return NextResponse.json({ settings: await getSettings() });
  } catch (e) {
    return NextResponse.json({ error: keapMessage(e as IntegrationError) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const denied = await allowed();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const tags: { id: number; name: string }[] = Array.isArray(b.tags) ? b.tags.filter((t: { id: unknown }) => Number.isInteger(Number(t?.id))).slice(0, 5) : [];
  const coachField = b.coachField === 'owner' || /^custom:\d+$/.test(String(b.coachField)) ? b.coachField : 'owner';
  const settings: WelcomeSettings = {
    tagIds: tags.map((t) => Number(t.id)),
    tagNames: tags.map((t) => String(t.name ?? t.id).slice(0, 80)),
    days: [7, 14, 30, 60, 90].includes(Number(b.days)) ? Number(b.days) : 14,
    coachField,
    coachFieldLabel: coachField === 'owner' ? undefined : String(b.coachFieldLabel ?? '').slice(0, 80),
  };
  await saveSettings(settings);
  clearClientCache();
  return NextResponse.json({ settings });
}
