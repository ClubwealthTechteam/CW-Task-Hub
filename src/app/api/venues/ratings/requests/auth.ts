/** Checks the venue-ratings routine key (constant-time), sent as "Authorization: Bearer <VENUE_RATINGS_SECRET>". */
export function ratingsRoutineAllowed(req: Request) {
  const secret = process.env.VENUE_RATINGS_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || secret.length < 16 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
