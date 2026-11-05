// Eventbrite events held at a venue (view-only).

import { NextResponse } from 'next/server';
import { findVenue } from '@/lib/venues/all';
import { eventsAtVenue } from '@/lib/venues/events';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { error } = await venuesUser();
  if (error) return error;
  const venue = await findVenue(String(new URL(req.url).searchParams.get('id') ?? ''));
  if (!venue) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(await eventsAtVenue(venue));
  } catch (e) {
    return NextResponse.json({ connected: true, events: [], error: (e as Error).message });
  }
}
