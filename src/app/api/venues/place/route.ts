// Address / phone / website for a venue (Google Places when GOOGLE_PLACES_API_KEY is set, else OpenStreetMap).

import { NextResponse } from 'next/server';
import { findVenue } from '@/lib/venues/all';
import { placeDetails } from '@/lib/venues/place';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { error } = await venuesUser();
  if (error) return error;
  const q = new URL(req.url).searchParams;
  const venue = await findVenue(String(q.get('id') ?? ''));
  if (!venue) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ place: await placeDetails(venue, q.get('fresh') === '1') });
}
