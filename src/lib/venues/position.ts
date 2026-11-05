// Where a venue's pin sits on the hub's map. Google pins start where Andrea's map has them; when the team
// drags a pin or moves it to a typed address, the new spot is saved here and wins over Google's.

import { getJSON, setJSON } from '@/lib/store';
import type { Venue } from './map';

const KEY = 'venues:positions';
export interface Position { lat: number; lng: number; at: number; by: string }

export const venuePositions = () => getJSON<Record<string, Position>>(KEY, {});

export async function setVenuePosition(id: string, lat: number, lng: number, by: string) {
  const all = await venuePositions();
  all[id] = { lat, lng, at: Date.now(), by };
  await setJSON(KEY, all);
  return all[id];
}

/** Applies the team's moved pins on top of Google's / the hub's locations. */
export function withPositions(venues: Venue[], pos: Record<string, Position>): Venue[] {
  return venues.map((v) => (pos[v.id] ? { ...v, lat: pos[v.id].lat, lng: pos[v.id].lng, moved: true } : v));
}
