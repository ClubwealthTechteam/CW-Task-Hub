// Events venues: GET the Google map's venues + the team's details; PUT saves one venue's details.
// Google My Maps is only read; the details live in the hub store.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { personById } from '@/config/people';
import { loadVenues } from '@/lib/venues/map';
import { allVenueInfo, canUseVenues, cleanVenueInfo, saveVenueInfo } from '@/lib/venues/info';

export const dynamic = 'force-dynamic';

async function who() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canUseVenues(user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user };
}

export async function GET(req: Request) {
  const { error } = await who();
  if (error) return error;
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  try {
    const [venues, info] = await Promise.all([loadVenues(fresh), allVenueInfo()]);
    const names = Object.fromEntries(
      [...new Set(Object.values(info).map((i) => i.updatedBy).filter(Boolean))].map((id) => [id, personById(id as string)?.name ?? id]),
    );
    return NextResponse.json({ venues, info, names });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const { user, error } = await who();
  if (error) return error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? '');
  const venues = await loadVenues().catch(() => []);
  if (!venues.some((v) => v.id === id)) return NextResponse.json({ error: 'That venue isn’t on the Google map anymore' }, { status: 404 });
  const saved = await saveVenueInfo(id, cleanVenueInfo((b.info ?? {}) as Record<string, unknown>), user!.id);
  return NextResponse.json({ info: saved, name: user!.name });
}
