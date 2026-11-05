// Venues the Events team adds in the hub (not pins on the Google map yet). Kept in the hub store with the
// address they typed; the location comes from looking that address up (see place.ts).

import { getJSON, setJSON } from '@/lib/store';
import type { Venue } from './map';

const KEY = 'venues:custom';

export const customVenues = () => getJSON<Venue[]>(KEY, []);

export async function addCustomVenue(v: Omit<Venue, 'id' | 'custom' | 'color' | 'icon'>): Promise<Venue> {
  const list = await customVenues();
  const id = `hub--${Date.now().toString(36)}`;
  const venue: Venue = { ...v, id, custom: true, color: '#5D6A82', icon: 'pin' };
  await setJSON(KEY, [...list, venue]);
  return venue;
}

export async function removeCustomVenue(id: string) {
  const list = await customVenues();
  await setJSON(KEY, list.filter((v) => v.id !== id));
  return list.some((v) => v.id === id);
}
