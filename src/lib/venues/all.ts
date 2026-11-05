// Every venue the page shows: the Google map's pins (or their last saved copy) plus venues added in the hub.

import { loadVenuesSafe, type Venue } from './map';
import { customVenues } from './custom';

export async function allVenues(fresh = false): Promise<{ venues: Venue[]; staleSince?: number; error?: string }> {
  const [g, c] = await Promise.all([loadVenuesSafe(fresh), customVenues()]);
  return { ...g, venues: [...g.venues, ...c] };
}

export async function findVenue(id: string) {
  const { venues } = await allVenues().catch(() => ({ venues: [] as Venue[] }));
  return venues.find((v) => v.id === id) ?? null;
}
