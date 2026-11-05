// Address, phone and website for a venue, filled in automatically so the team doesn't have to type them.
// With GOOGLE_PLACES_API_KEY set it asks Google Places (best match near the pin); otherwise it uses
// OpenStreetMap (free, address mostly, phone/website only when OSM has them). Saved per venue once found.

import { getJSON, setJSON } from '@/lib/store';
import type { Venue } from './map';

export interface PlaceDetails { address?: string; phone?: string; website?: string; source: 'google' | 'openstreetmap'; nearest?: boolean; at: number }

const key = (id: string) => `venues:place:${id}`;
const UA = 'CW-Admin-Hub/1.0 (Club Wealth events venues)';

async function fromGoogle(v: Venue): Promise<PlaceDetails | null> {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) return null;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': k,
      'X-Goog-FieldMask': 'places.formattedAddress,places.nationalPhoneNumber,places.websiteUri',
    },
    body: JSON.stringify({ textQuery: v.name, locationBias: { circle: { center: { latitude: v.lat, longitude: v.lng }, radius: 500 } }, maxResultCount: 1 }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const p = (await res.json())?.places?.[0];
  if (!p) return null;
  return { address: p.formattedAddress, phone: p.nationalPhoneNumber, website: p.websiteUri, source: 'google', at: Date.now() };
}

async function fromOsm(v: Venue): Promise<PlaceDetails | null> {
  const d = 0.004; // ~400 m box around the pin
  const box = `${v.lng - d},${v.lat + d},${v.lng + d},${v.lat - d}`;
  const q = new URLSearchParams({ q: v.name, format: 'jsonv2', extratags: '1', addressdetails: '0', limit: '1', viewbox: box, bounded: '1' });
  let nearest = false;
  let hit = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': UA }, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : [])).then((a) => a?.[0]).catch(() => null);
  if (!hit) {
    nearest = true; // OSM doesn't know the venue by name: give the closest street address to the pin
    hit = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${v.lat}&lon=${v.lng}&format=jsonv2&extratags=1&zoom=18`, { headers: { 'User-Agent': UA }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  if (!hit?.display_name) return null;
  const t = hit.extratags ?? {};
  return { address: hit.display_name, phone: t.phone || t['contact:phone'], website: t.website || t['contact:website'], source: 'openstreetmap', nearest, at: Date.now() };
}

/** Saved details for a venue, looking them up the first time (or again with `fresh`). */
export async function placeDetails(v: Venue, fresh = false): Promise<PlaceDetails | null> {
  if (!fresh) {
    const saved = await getJSON<PlaceDetails | null>(key(v.id), null);
    if (saved) return saved;
  }
  const found = (await fromGoogle(v).catch(() => null)) ?? (await fromOsm(v).catch(() => null));
  if (found) await setJSON(key(v.id), found);
  return found;
}

/** Where an address is (for venues added in the hub). */
export async function geocode(address: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (k) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.formattedAddress,places.location' },
      body: JSON.stringify({ textQuery: address, maxResultCount: 1 }), cache: 'no-store',
    }).catch(() => null);
    const p = res?.ok ? (await res.json())?.places?.[0] : null;
    if (p?.location) return { lat: p.location.latitude, lng: p.location.longitude, address: p.formattedAddress ?? address };
  }
  const q = new URLSearchParams({ q: address, format: 'jsonv2', limit: '1', countrycodes: 'us' });
  const hit = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': UA }, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : [])).then((a) => a?.[0]).catch(() => null);
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), address: hit.display_name } : null;
}
