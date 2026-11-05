// Events venues: GET the venues (Google map + hub-added) with the team's details; PUT saves one venue's
// details (refused with 409 if someone else saved it after the person opened it).

import { NextResponse } from 'next/server';
import { personById } from '@/config/people';
import { allVenues, findVenue } from '@/lib/venues/all';
import { allVenueInfo, cleanVenueInfo, saveVenueInfo, VenueConflict } from '@/lib/venues/info';
import { venuesUser } from './guard';

export const dynamic = 'force-dynamic';

const nameOf = (id?: string) => (id ? personById(id)?.name ?? id : undefined);

export async function GET(req: Request) {
  const { error } = await venuesUser();
  if (error) return error;
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  try {
    const [{ venues, staleSince, error: googleError }, info] = await Promise.all([allVenues(fresh), allVenueInfo()]);
    const ids = new Set(Object.values(info).flatMap((i) => [i.updatedBy, ...(i.files ?? []).map((f) => f.by)]).filter(Boolean) as string[]);
    const names = Object.fromEntries([...ids].map((id) => [id, nameOf(id)]));
    return NextResponse.json({ venues, info, names, staleSince, googleError });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const { user, error } = await venuesUser();
  if (error) return error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? '');
  if (!(await findVenue(id))) return NextResponse.json({ error: 'That venue isn’t on the map anymore' }, { status: 404 });
  try {
    const saved = await saveVenueInfo(id, cleanVenueInfo((b.info ?? {}) as Record<string, unknown>), user!.id, Number(b.baseUpdatedAt) || 0);
    return NextResponse.json({ info: saved, name: user!.name });
  } catch (e) {
    if (e instanceof VenueConflict) {
      return NextResponse.json({ error: `${nameOf(e.current.updatedBy) ?? 'Someone'} saved this venue after you opened it.`, conflict: true, info: e.current, name: nameOf(e.current.updatedBy) }, { status: 409 });
    }
    throw e;
  }
}
