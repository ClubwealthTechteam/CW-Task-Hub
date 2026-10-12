// Read-only Eventbrite views for the Eventbrite tab.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';
import { callEventbrite, eventbriteMessage } from '@/lib/integrations/eventbrite/client';
import type { IntegrationError } from '@/lib/integrations/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { capability: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canViewEventbrite(user)) return NextResponse.json({ error: 'Eventbrite is for the Events team and super admins' }, { status: 403 });
  const query: Record<string, unknown> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (/^[a-zA-Z_.]{1,40}$/.test(k)) query[k] = v.slice(0, 300);
  try {
    return NextResponse.json({ data: await callEventbrite(params.capability, query) });
  } catch (e) {
    const err = e as IntegrationError;
    return NextResponse.json({ error: eventbriteMessage(err) }, { status: err.status === 404 ? 404 : err.status === 403 ? 403 : 502 });
  }
}
