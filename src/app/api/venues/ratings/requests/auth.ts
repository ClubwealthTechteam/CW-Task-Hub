/**
 * Checks the venue-ratings routine key (constant-time), sent as "Authorization: Bearer <key>".
 * Accepts VENUE_RATINGS_SECRET or ROUTINES_REPORT_SECRET: the Claude routines' network proxy holds
 * one Authorization key per host, and for this hub that is the routines report key, so the
 * rating-DM routine arrives with that one.
 */
export function ratingsRoutineAllowed(req: Request) {
  const got = req.headers.get('authorization') ?? '';
  return [process.env.VENUE_RATINGS_SECRET, process.env.ROUTINES_REPORT_SECRET].some((s) => matches(got, s));
}

/** True when ratings routine keys are configured at all. */
export const ratingsRoutineConfigured = () =>
  [process.env.VENUE_RATINGS_SECRET, process.env.ROUTINES_REPORT_SECRET].some((s) => !!s && s.length >= 16);

function matches(got: string, secret: string | undefined) {
  if (!secret || secret.length < 16) return false;
  const want = `Bearer ${secret}`;
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
