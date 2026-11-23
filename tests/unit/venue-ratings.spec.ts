// Post-event venue ratings: what the rating page may send, one rating per person per event, and the
// Slack DMs the routine still has to send.
import { expect, test } from '@playwright/test';
import { personById } from '../../src/config/people';
import {
  canRateVenues, cleanRating, isEventId, markRequestsSent, pendingRequests, saveRating, sentRequests, venueRatings, latestVerdicts,
} from '../../src/lib/venues/ratings';

for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];

const full = { scores: { cleanliness: 'Good', staff: 'Okay', arrangement: 'Bad', neighborhood: 'Good' }, verdict: 'Not recommended next time' };

test('a full rating is accepted; the note is trimmed and optional', () => {
  expect(cleanRating({ ...full, note: '  Parking was tight  ' })).toEqual({ rating: { ...full, note: 'Parking was tight' } });
  expect(cleanRating({ ...full, note: '   ' })).toEqual({ rating: { ...full, note: undefined } });
  const long = cleanRating({ ...full, note: 'x'.repeat(5000) });
  expect('rating' in long && long.rating.note?.length).toBe(1000);
});

test('every area needs Good, Okay or Bad, and a known verdict', () => {
  expect(cleanRating({ ...full, scores: { cleanliness: 'Good' } })).toEqual({ error: 'Pick Good, Okay or Bad for Staff & association, Arrangement, Neighborhood' });
  expect(cleanRating({ ...full, scores: { ...full.scores, staff: 'Great' } })).toEqual({ error: 'Pick Good, Okay or Bad for Staff & association' });
  expect(cleanRating({ ...full, scores: undefined })).toHaveProperty('error');
  expect(cleanRating({ ...full, verdict: 'Meh' })).toEqual({ error: 'Pick an overall verdict' });
  expect(cleanRating({ scores: full.scores })).toEqual({ error: 'Pick an overall verdict' });
  // Extra fields are dropped.
  const r = cleanRating({ ...full, scores: { ...full.scores, extra: 'Good' }, by: 'someone' });
  expect(r).toEqual({ rating: { ...full, note: undefined } });
});

test('who can rate: Andrea, Liz, Miguel and super admins, not the rest of the team', () => {
  expect(canRateVenues(personById('andrea'))).toBe(true);
  expect(canRateVenues(personById('liz'))).toBe(true);
  expect(canRateVenues(personById('miguel'))).toBe(true);
  expect(canRateVenues(personById('omerson'))).toBe(true); // super admin
  expect(canRateVenues(personById('camille'))).toBe(true); // super admin, but no DM
  expect(canRateVenues(personById('ali'))).toBe(false);
  expect(canRateVenues(personById('tara'))).toBe(false);
  expect(canRateVenues(null)).toBe(false);
  expect(isEventId('1234567890')).toBe(true);
  expect(isEventId('12a')).toBe(false);
});

test('one rating per person per event: sending again replaces their own; latest first', async () => {
  const v = 'test--venue-ratings';
  const base = { scores: full.scores as never, verdict: 'All good' };
  await saveRating(v, { ...base, eventId: '111', by: 'tara', at: 1000 });
  await saveRating(v, { ...base, eventId: '111', by: 'miguel', at: 2000, verdict: 'Do not come back' });
  await saveRating(v, { ...base, eventId: '222', by: 'tara', at: 3000 });
  await saveRating(v, { ...base, eventId: '111', by: 'tara', at: 4000, verdict: 'Not recommended next time', note: 'changed my mind' });
  const list = await venueRatings(v);
  expect(list.map((r) => `${r.eventId}:${r.by}:${r.verdict}`)).toEqual([
    '111:tara:Not recommended next time', '222:tara:All good', '111:miguel:Do not come back',
  ]);
  expect(await latestVerdicts([v, 'test--no-ratings'])).toEqual({ [v]: 'Not recommended next time' });
});

test('rating DMs: each rater once per event, with the venue, place, date and link', async () => {
  const events = [{ eventId: '999', eventName: 'Half-Day Orlando', eventDate: '2026-11-22', venueId: 'florida--orlando', venueName: 'Orlando Regional REALTOR® Association', place: 'Orlando, FL' }];
  let reqs = pendingRequests(events, await sentRequests(), 'https://hub.example');
  expect(reqs).toHaveLength(1);
  expect(reqs[0].link).toBe('https://hub.example/venues/rate/florida--orlando/999');
  expect(reqs[0].recipients.map((r) => r.personId)).toEqual(['andrea', 'liz', 'miguel']);
  expect(reqs[0].recipients[0]).toEqual({
    personId: 'andrea', name: 'Andrea Uy', slackId: 'U0AJX1UUZKK',
    message: 'How was Orlando Regional REALTOR® Association (Orlando, FL, Nov 22, 2026)? Rate it here: https://hub.example/venues/rate/florida--orlando/999',
  });
  expect(reqs[0].recipients[1].slackId).toBe('U0AJBMGH96F'); // Liz
  expect(reqs[0].recipients[2].slackId).toBe('U0C6BGGHY3C'); // Miguel

  await markRequestsSent('999', ['andrea', 'miguel']);
  reqs = pendingRequests(events, await sentRequests(), 'https://hub.example');
  expect(reqs[0].recipients.map((r) => r.personId)).toEqual(['liz']);
  await markRequestsSent('999', ['liz']);
  expect(pendingRequests(events, await sentRequests(), 'https://hub.example')).toEqual([]);
});

test('sent records older than 90 days are dropped', async () => {
  const now = Date.UTC(2026, 10, 23);
  await markRequestsSent('1', ['tara'], now - 100 * 86_400_000);
  const sent = await markRequestsSent('2', ['tara'], now);
  expect(sent['1:tara']).toBeUndefined();
  expect(sent['2:tara']).toBe(now);
});
