// Post-event venue ratings. GET ?id=<venue>: the venue's ratings, latest first (the Events team and raters).
// POST: one person's rating of a venue for an event (Tara, Miguel, Camille and super admins); sending
// again for the same event replaces their own rating.

import { NextResponse } from 'next/server';
import { personById } from '@/config/people';
import { getCurrentUser } from '@/lib/auth/current-user';
import { findVenue } from '@/lib/venues/all';
import { findEvent } from '@/lib/venues/events';
import { canUseVenues } from '@/lib/venues/info';
import { canRateVenues, cleanRating, isEventId, saveRating, venueRatings } from '@/lib/venues/ratings';

export const dynamic = 'force-dynamic';

const withNames = <T extends { by: string }>(list: T[]) => list.map((r) => ({ ...r, byName: personById(r.by)?.name ?? r.by }));

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canUseVenues(user) && !canRateVenues(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const id = String(new URL(req.url).searchParams.get('id') ?? '');
  return NextResponse.json({ ratings: withNames(await venueRatings(id)) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canRateVenues(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const venueId = String(b.venueId ?? '');
  if (!isEventId(b.eventId)) return NextResponse.json({ error: 'That event link isn’t right' }, { status: 400 });
  const venue = await findVenue(venueId);
  if (!venue) return NextResponse.json({ error: 'That venue isn’t on the map anymore' }, { status: 404 });
  const clean = cleanRating(b);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  // The event's name and date come from Eventbrite, not from the browser.
  const ev = await findEvent(b.eventId).catch(() => null);
  const ratings = await saveRating(venue.id, {
    eventId: b.eventId, eventName: ev?.name, eventDate: ev?.start?.slice(0, 10) || undefined, by: user.id, at: Date.now(), ...clean.rating,
  });
  return NextResponse.json({ ratings: withNames(ratings) });
}
