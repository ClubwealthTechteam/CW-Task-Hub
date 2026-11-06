// Address, phone and website for a venue, filled in automatically so the team doesn't have to type them.
// With GOOGLE_PLACES_API_KEY set it asks Google Places (best match near the pin); otherwise it uses
// OpenStreetMap (free, address mostly, phone/website only when OSM has them). Saved per venue once found.

import { getJSON, setJSON } from '@/lib/store';
import type { Venue } from './map';
import { eventbriteAddress } from './events';

export interface PlaceDetails { address?: string; phone?: string; website?: string; source: 'pin' | 'eventbrite' | 'google' | 'openstreetmap'; nearest?: boolean; at: number }

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

/**
 * Address / phone / website for a venue, best source first:
 * 1. what the team wrote on the Google pin (Address: / Phone: / Website: lines),
 * 2. the address Eventbrite has saved for this venue,
 * 3. Google Places (only with GOOGLE_PLACES_API_KEY), then OpenStreetMap (saved once found).
 */
export async function placeDetails(v: Venue, fresh = false): Promise<PlaceDetails | null> {
  const pin = v.pin && (v.pin.address || v.pin.phone || v.pin.website) ? v.pin : null;
  const eb = !pin?.address ? await eventbriteAddress(v).catch(() => null) : null;
  if (pin && (pin.address || !eb)) return { address: pin.address, phone: pin.phone, website: pin.website, source: 'pin', at: Date.now() };
  if (eb) return { address: eb, phone: pin?.phone, website: pin?.website, source: 'eventbrite', at: Date.now() };
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
  // OpenStreetMap often finds nothing when the address has a suite/unit ("#100", "Suite 200") or a
  // country name, so retry with those parts removed. If a shortened version is what matched, keep the
  // address as the team typed it (suite included) so it isn't lost.
  const tries = addressVariants(address);
  for (let i = 0; i < tries.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1100)); // OpenStreetMap allows 1 lookup per second
    const q = new URLSearchParams({ q: tries[i], format: 'jsonv2', limit: '1', countrycodes: 'us' });
    const hit = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': UA }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : [])).then((a) => a?.[0]).catch(() => null);
    if (hit) return { lat: Number(hit.lat), lng: Number(hit.lon), address: i ? address : hit.display_name };
  }
  return null;
}

/** The address as typed, then without suite/unit numbers and country, then also without the ZIP. */
export function addressVariants(address: string): string[] {
  const tidy = (s: string) => s.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
  const noCountry = address.replace(/,?\s*(united states( of america)?|u\.?s\.?a\.?)\s*$/i, '');
  const noSuite = noCountry
    .replace(/\s*(?:,\s*)?#\s*[\w-]+\b/g, '')
    .replace(/\s*(?:,\s*)?\b(?:suite|ste|unit|apt|apartment|room|rm|fl|floor|bldg|building)\b\.?\s*#?\s*(?:[\w-]*\d[\w-]*|[a-z])\b/gi, '');
  const noZip = noSuite.replace(/\s+\d{5}(?:-\d{4})?\s*$/, '');
  return [...new Set([address, noSuite, noZip].map(tidy).filter(Boolean))];
}
