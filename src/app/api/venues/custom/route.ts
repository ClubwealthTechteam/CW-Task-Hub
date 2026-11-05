// Add a venue in the hub (name, state, address → located by address lookup), or remove one added here.
// Google pins can't be added from the hub; the page reminds the team to add the pin in Google too.

import { NextResponse } from 'next/server';
import { addCustomVenue, removeCustomVenue } from '@/lib/venues/custom';
import { geocode } from '@/lib/venues/place';
import { logChanges, saveVenueInfo, VENUE_TYPES } from '@/lib/venues/info';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { user, error } = await venuesUser();
  if (error) return error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().slice(0, 150);
  const state = String(b.state ?? '').trim().toUpperCase().slice(0, 40);
  const address = String(b.address ?? '').trim().slice(0, 300);
  if (!name || !state || !address) return NextResponse.json({ error: 'Add the venue’s name, state and address' }, { status: 400 });
  const at = await geocode(address);
  if (!at) return NextResponse.json({ error: 'Couldn’t find that address. Try adding the city and ZIP.' }, { status: 400 });
  const venue = await addCustomVenue({ name, state, lat: at.lat, lng: at.lng, address: at.address });
  await logChanges(venue.id, [{ at: Date.now(), by: user!.id, field: 'added', to: `Added in the hub (${at.address})` }]);
  const type = VENUE_TYPES.find((t) => t === b.type);
  const info = await saveVenueInfo(venue.id, { type, address: at.address }, user!.id, 0);
  return NextResponse.json({ venue, info });
}

export async function DELETE(req: Request) {
  const { error } = await venuesUser();
  if (error) return error;
  const id = String(new URL(req.url).searchParams.get('id') ?? '');
  if (!id.startsWith('hub--')) return NextResponse.json({ error: 'Only venues added in the hub can be removed here' }, { status: 400 });
  return NextResponse.json({ removed: await removeCustomVenue(id) });
}
