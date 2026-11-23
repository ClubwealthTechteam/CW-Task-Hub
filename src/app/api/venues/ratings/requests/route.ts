// For the "Venue rating DMs" Claude routine (the hub has no Slack bot of its own). Needs
// "Authorization: Bearer <VENUE_RATINGS_SECRET>".
// GET ?date=YYYY-MM-DD (default: yesterday, Pacific): the events held that day at a venue on the map, each
//   with the Slack DMs still to send (people already DMed for that event are left out).
// POST { eventId, personIds: [...] }: records that those people were DMed, so they aren't DMed again.

import { NextResponse } from 'next/server';
import { allVenues } from '@/lib/venues/all';
import { eventsHeldOn } from '@/lib/venues/events';
import { eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { isEventId, markRequestsSent, pendingRequests, sentRequests, VENUE_RATERS } from '@/lib/venues/ratings';
import { ratingsRoutineAllowed } from './auth';

export const dynamic = 'force-dynamic';

const yesterdayPacific = () => new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

function guard(req: Request) {
  if (!process.env.VENUE_RATINGS_SECRET) return NextResponse.json({ error: 'Add VENUE_RATINGS_SECRET in Vercel' }, { status: 503 });
  if (!ratingsRoutineAllowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return null;
}

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const asked = url.searchParams.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : yesterdayPacific();
  if (!eventbriteConfigured()) return NextResponse.json({ date, eventbrite: false, requests: [] });
  const { venues } = await allVenues();
  const [events, sent] = await Promise.all([eventsHeldOn(date, venues), sentRequests()]);
  return NextResponse.json({ date, eventbrite: true, requests: pendingRequests(events, sent, url.origin) });
}

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const people = Array.isArray(b.personIds) ? b.personIds.filter((p): p is string => typeof p === 'string' && VENUE_RATERS.includes(p)) : [];
  if (!isEventId(b.eventId) || !people.length) return NextResponse.json({ error: 'Send eventId and personIds (tara, miguel, camille)' }, { status: 400 });
  await markRequestsSent(b.eventId, people);
  return NextResponse.json({ recorded: people.map((p) => `${b.eventId}:${p}`) });
}
