// Home page shift summary maker. POST { notes, hours } starts it; GET ?id=<conversationId> checks for it.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { chatIsConfigured } from '@/lib/chat/routine';
import { countMessage, usageFor } from '@/lib/chat/usage';
import { storeIsPersistent } from '@/lib/store';
import { dayFacts, shiftSummaryResult, startShiftSummary } from '@/lib/home/shift-summary';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ facts: await dayFacts(user) });
  const result = await shiftSummaryResult(user, id);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!chatIsConfigured() || !storeIsPersistent()) return NextResponse.json({ error: 'CW Assistant isn’t switched on yet. Ask Miguel to finish the setup.' }, { status: 503 });
  const usage = await usageFor(user);
  if (usage.left === 0) return NextResponse.json({ error: `You’ve used your ${usage.limit} CW Assistant messages for today.` }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  try {
    const started = await startShiftSummary(user, body.notes, body.hours);
    await countMessage(user);
    return NextResponse.json(started);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
