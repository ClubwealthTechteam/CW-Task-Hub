// A venue's change history: who changed what, from what to what, and when.

import { NextResponse } from 'next/server';
import { personById } from '@/config/people';
import { venueHistory } from '@/lib/venues/info';
import { venuesUser } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { error } = await venuesUser();
  if (error) return error;
  const h = await venueHistory(String(new URL(req.url).searchParams.get('id') ?? ''));
  return NextResponse.json({ history: h.map((c) => ({ ...c, byName: personById(c.by)?.name ?? c.by })) });
}
