import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUseVenues } from '@/lib/venues/info';

/** Signed-in Events team members and super admins only (others get 404, like other team pages). */
export async function venuesUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) };
  if (!canUseVenues(user)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { user };
}
