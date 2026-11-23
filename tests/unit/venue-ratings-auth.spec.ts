// The rating-DM routine's key: VENUE_RATINGS_SECRET or ROUTINES_REPORT_SECRET, nothing else.
import { expect, test } from '@playwright/test';
import { ratingsRoutineAllowed, ratingsRoutineConfigured } from '../../src/app/api/venues/ratings/requests/auth';

const req = (auth?: string) => new Request('https://hub.test/api/venues/ratings/requests', { headers: auth ? { authorization: auth } : {} });
const V = 'venue-secret-0123456789', R = 'routines-secret-0123456789';

test.afterEach(() => { delete process.env.VENUE_RATINGS_SECRET; delete process.env.ROUTINES_REPORT_SECRET; });

test('either key is accepted; a wrong, missing or short key is not', () => {
  process.env.VENUE_RATINGS_SECRET = V; process.env.ROUTINES_REPORT_SECRET = R;
  expect(ratingsRoutineAllowed(req(`Bearer ${V}`))).toBe(true);
  expect(ratingsRoutineAllowed(req(`Bearer ${R}`))).toBe(true);
  expect(ratingsRoutineAllowed(req('Bearer nope-nope-nope-nope-nope'))).toBe(false);
  expect(ratingsRoutineAllowed(req())).toBe(false);
  expect(ratingsRoutineAllowed(req(V))).toBe(false);
});

test('with no keys set, nothing is accepted and the route reports it is not configured', () => {
  expect(ratingsRoutineConfigured()).toBe(false);
  expect(ratingsRoutineAllowed(req('Bearer '))).toBe(false);
  process.env.VENUE_RATINGS_SECRET = 'short';
  expect(ratingsRoutineConfigured()).toBe(false);
  expect(ratingsRoutineAllowed(req('Bearer short'))).toBe(false);
  process.env.ROUTINES_REPORT_SECRET = R;
  expect(ratingsRoutineConfigured()).toBe(true);
});
