// The post-event venue rating page, opened from the Slack DM the day after a half-day event. Phone-first
// (people tap it from Slack), so unlike the rest of the hub it isn't replaced by the "desktop only" screen.
// Signed-out people go through the normal sign-in and come back here.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { findVenue } from '@/lib/venues/all';
import { findEvent } from '@/lib/venues/events';
import { canRateVenues, isEventId, RATING_AREAS, RATING_SCORES, RATING_VERDICTS, venueRatings } from '@/lib/venues/ratings';
import { RateForm } from './RateForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rate the venue · CW AI Task Hub' };

export default async function RateVenuePage(props: { params: Promise<{ venueId: string; eventId: string }> }) {
  const { venueId, eventId } = await props.params;
  const user = await requireUser();
  if (!canRateVenues(user) || !isEventId(eventId)) notFound();
  const venue = await findVenue(decodeURIComponent(venueId));
  if (!venue) notFound();
  const [event, ratings] = await Promise.all([findEvent(eventId).catch(() => null), venueRatings(venue.id)]);
  const mine = ratings.find((r) => r.eventId === eventId && r.by === user.id);
  const date = event?.start ? new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <main className="vr-page">
      <div className="vr-card">
        <div className="vr-brand"><b>CLUBWEALTH</b><span>Venue rating</span></div>
        <h1>How was {venue.name}?</h1>
        <p className="vr-sub">{[event?.name ?? `Event ${eventId}`, date].filter(Boolean).join(' · ')}</p>
        <RateForm venueId={venue.id} eventId={eventId} firstName={user.name.split(/\s+/)[0]}
          areas={RATING_AREAS.map((a) => ({ id: a.id, label: a.label }))} scores={[...RATING_SCORES]} verdicts={[...RATING_VERDICTS]}
          initial={mine ? { scores: mine.scores, verdict: mine.verdict, note: mine.note ?? '' } : undefined} />
      </div>
    </main>
  );
}
