// Post-event venue ratings: the day after a half-day event, Tara, Miguel and Camille each get a Slack DM
// (sent by a Claude routine, see /api/venues/ratings/requests) with a link to rate the venue for that event.
// A rating is saved on the venue: four areas (Good / Okay / Bad), an overall verdict and an optional note.
// One rating per person per event: sending again replaces their own.

import { personById, type Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { getJSON, setJSON } from '@/lib/store';

export const RATING_AREAS = [
  { id: 'cleanliness', label: 'Cleanliness' },
  { id: 'staff', label: 'Staff & association' },
  { id: 'arrangement', label: 'Arrangement' },
  { id: 'neighborhood', label: 'Neighborhood' },
] as const;
export type RatingArea = (typeof RATING_AREAS)[number]['id'];
export const RATING_SCORES = ['Good', 'Okay', 'Bad'] as const;
export const RATING_VERDICTS = ['All good', 'Not recommended next time', 'Do not come back'] as const;

/** Who gets the DM and can rate (plus super admins). */
export const VENUE_RATERS = ['tara', 'miguel', 'camille'];
export const canRateVenues = (user: Person | null | undefined) => Boolean(user) && (isSuperAdmin(user) || VENUE_RATERS.includes(user!.id));

/** Slack member ids for the DM. Camille's isn't known yet: fill it in, until then the routine skips her. */
export const CAMILLE_SLACK_ID = '';
export const RATER_SLACK_IDS: Record<string, string> = { tara: 'U03JNPKQ2G2', miguel: 'U0C6BGGHY3C', camille: CAMILLE_SLACK_ID };

export interface VenueRating {
  eventId: string;
  eventName?: string;
  eventDate?: string;          // YYYY-MM-DD (the event's local date)
  by: string;                  // person id
  at: number;
  scores: Record<RatingArea, string>;
  verdict: string;
  note?: string;
}

const ratingsKey = (venueId: string) => `venues:ratings:${venueId}`;
const SENT_KEY = 'venues:rating-requests:sent';

export const isEventId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,20}$/.test(v);

/** Checks what the rating page sent: every area scored, a verdict, a short note. Returns the clean rating or what's missing. */
export function cleanRating(b: Record<string, unknown>): { rating: Pick<VenueRating, 'scores' | 'verdict' | 'note'> } | { error: string } {
  const raw = (b.scores && typeof b.scores === 'object' ? b.scores : {}) as Record<string, unknown>;
  const scores = {} as Record<RatingArea, string>;
  const missing: string[] = [];
  for (const a of RATING_AREAS) {
    const s = RATING_SCORES.find((x) => x === raw[a.id]);
    if (s) scores[a.id] = s; else missing.push(a.label);
  }
  if (missing.length) return { error: `Pick Good, Okay or Bad for ${missing.join(', ')}` };
  const verdict = RATING_VERDICTS.find((v) => v === b.verdict);
  if (!verdict) return { error: 'Pick an overall verdict' };
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 1000) || undefined : undefined;
  return { rating: { scores, verdict, note } };
}

/** A venue's ratings, latest first. */
export async function venueRatings(venueId: string): Promise<VenueRating[]> {
  const list = await getJSON<VenueRating[]>(ratingsKey(venueId), []);
  return [...list].sort((a, b) => b.at - a.at);
}

/** Saves one person's rating of a venue for an event, replacing their earlier one for the same event. */
export async function saveRating(venueId: string, r: VenueRating): Promise<VenueRating[]> {
  const list = await getJSON<VenueRating[]>(ratingsKey(venueId), []);
  const next = [r, ...list.filter((x) => !(x.eventId === r.eventId && x.by === r.by))].slice(0, 300);
  await setJSON(ratingsKey(venueId), next);
  return [...next].sort((a, b) => b.at - a.at);
}

/** The latest verdict per venue (for the export). */
export async function latestVerdicts(venueIds: string[]): Promise<Record<string, string>> {
  const all = await Promise.all(venueIds.map(async (id) => [id, (await venueRatings(id))[0]?.verdict] as const));
  return Object.fromEntries(all.filter(([, v]) => v)) as Record<string, string>;
}

// --- Which DMs were already sent (so nobody gets two for the same event) ---

const sentId = (eventId: string, personId: string) => `${eventId}:${personId}`;
export const sentRequests = () => getJSON<Record<string, number>>(SENT_KEY, {});

/** Records that these people were DMed about this event. Entries older than 90 days are dropped. */
export async function markRequestsSent(eventId: string, personIds: string[], now = Date.now()) {
  const sent = await sentRequests();
  for (const p of personIds) sent[sentId(eventId, p)] = now;
  const cutoff = now - 90 * 86_400_000;
  for (const [k, at] of Object.entries(sent)) if (at < cutoff) delete sent[k];
  await setJSON(SENT_KEY, sent);
  return sent;
}

export interface RatingRequest {
  eventId: string; eventName: string; eventDate: string; venueId: string; venueName: string; place: string;
  link: string;
  recipients: { personId: string; name: string; slackId: string | null; message: string }[];
}

/** Builds the DMs still to send for these events (people already DMed for an event are left out). */
export function pendingRequests(
  events: { eventId: string; eventName: string; eventDate: string; venueId: string; venueName: string; place: string }[],
  sent: Record<string, number>, origin: string,
): RatingRequest[] {
  return events.map((e) => {
    const link = `${origin}/venues/rate/${encodeURIComponent(e.venueId)}/${e.eventId}`;
    const when = new Date(`${e.eventDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const where = [e.place, when].filter(Boolean).join(', ');
    return {
      ...e, link,
      recipients: VENUE_RATERS.filter((p) => !sent[sentId(e.eventId, p)]).map((p) => ({
        personId: p, name: personById(p)?.name ?? p, slackId: RATER_SLACK_IDS[p] || null,
        message: `How was ${e.venueName} (${where})? Rate it here: ${link}`,
      })),
    };
  }).filter((r) => r.recipients.length);
}
