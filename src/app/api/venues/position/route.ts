// Moves a venue's pin on the hub's map: to coordinates (dragged pin) or to an address (looked up).
// Google My Maps is never changed; the hub's spot wins over Google's from then on.

import { NextResponse } from 'next/server';
import { findVenue } from '@/lib/venues/all';
import { logChanges } from '@/lib/venues/info';
import { geocode } from '@/lib/venues/place';
import { setVenuePosition } from '@/lib/venues/position';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

const inUS = (lat: number, lng: number) => lat > 15 && lat < 72 && lng > -180 && lng < -60;

export async function POST(req: Request) {
  const { user, error } = await venuesUser();
  if (error) return error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const venue = await findVenue(String(b.id ?? ''));
  if (!venue) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let lat = Number(b.lat), lng = Number(b.lng), how = 'dragged on the map';
  if (typeof b.address === 'string' && b.address.trim()) {
    const at = await geocode(b.address.trim().slice(0, 300));
    if (!at) return NextResponse.json({ error: 'Couldn’t find that address on the map. Try adding the city and ZIP, or drag the pin.' }, { status: 400 });
    ({ lat, lng } = at); how = `moved to ${b.address.toString().trim().slice(0, 120)}`;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inUS(lat, lng)) return NextResponse.json({ error: 'That spot is outside the US' }, { status: 400 });
  const pos = await setVenuePosition(venue.id, lat, lng, user!.id);
  await logChanges(venue.id, [{ at: pos.at, by: user!.id, field: 'location', from: `${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}`, to: `${lat.toFixed(5)}, ${lng.toFixed(5)} (${how})` }]);
  return NextResponse.json({ lat, lng });
}
