// Keap tags for the Social Media settings (read-only). GET ?q= searches every tag by any part of its name;
// GET ?purpose=new-client|member returns ranked suggestions and Claude's pick; POST ?purpose= asks Claude again.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { keapMessage } from '@/lib/integrations/keap/contacts';
import { IntegrationError } from '@/lib/integrations/http';
import { canUseWelcome } from '@/lib/welcome/access';
import { allTags, candidates, claudePick, searchTags, startClaudePick, type TagPurpose } from '@/lib/integrations/keap/tag-suggest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const purposeOf = (v: string | null): TagPurpose | null => (v === 'new-client' || v === 'member' ? v : null);
const DAY = 86_400_000;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const q = new URL(req.url).searchParams;
  try {
    if (q.get('q')) return NextResponse.json({ tags: await searchTags(String(q.get('q')).slice(0, 60)) });
    const purpose = purposeOf(q.get('purpose'));
    if (!purpose) return NextResponse.json({ error: 'Say what the tag is for' }, { status: 400 });
    const list = await candidates(purpose);
    const ids = new Set((await allTags()).map((t) => t.id));
    let pick = await claudePick(purpose, ids);
    // Ask Claude when there's no recent answer (once a day is plenty).
    if (list.length && (!pick || (pick.status !== 'thinking' && Date.now() - pick.at > DAY))) pick = await startClaudePick(user, purpose, list);
    return NextResponse.json({ candidates: list, pick });
  } catch (e) {
    return NextResponse.json({ error: keapMessage(e as IntegrationError) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseWelcome(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const purpose = purposeOf(new URL(req.url).searchParams.get('purpose'));
  if (!purpose) return NextResponse.json({ error: 'Say what the tag is for' }, { status: 400 });
  try {
    return NextResponse.json({ pick: await startClaudePick(user, purpose, await candidates(purpose)) });
  } catch (e) {
    return NextResponse.json({ error: keapMessage(e as IntegrationError) }, { status: 502 });
  }
}
