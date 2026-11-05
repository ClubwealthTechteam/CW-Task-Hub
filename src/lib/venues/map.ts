// Events venues: the pins come from the Events team's Google My Maps ("CLUB WEALTH · Venues", by Andrea).
// Google stays the source of the map, the icons and the locations; the hub reads the map's public KML
// (read-only) and keeps the team's own notes per venue (description, tags, status…) in the hub store.

import { cached, getJSON, setJSON } from '@/lib/store';

export const VENUES_MAP_ID = process.env.VENUES_MAP_ID || '1GEQFYF9PwO9KglYxxgcwkEp7efWJBYM';
export const venuesEmbedUrl = (ll?: [number, number], zoom?: number) =>
  `https://www.google.com/maps/d/embed?mid=${VENUES_MAP_ID}${ll ? `&ll=${ll[0]},${ll[1]}&z=${zoom ?? 14}` : ''}`;
export const venuesEditUrl = () => `https://www.google.com/maps/d/edit?mid=${VENUES_MAP_ID}`;

export interface Venue {
  id: string;
  name: string;
  state: string;          // the My Maps layer (FLORIDA, NEW YORK…)
  lat: number;
  lng: number;
  color: string;          // pin color from Google, e.g. "#C2185B"
  icon: 'pin' | 'letter'; // 1899 = plain pin, others = lettered/marked pin
  custom?: boolean;       // added in the hub, not (yet) a pin on the Google map
  address?: string;       // hub-added venues: the address the team typed
  pin?: PinNotes;         // what the team wrote in the pin's description on the Google map
  moved?: boolean;        // the team moved this pin in the hub (position.ts)
}

/** "Address: …", "Phone: …", "Website: …" lines (and any other text) typed in a pin's description in My Maps. */
export interface PinNotes { address?: string; phone?: string; website?: string; text?: string }

export function parsePinDescription(raw: string): PinNotes | undefined {
  const text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (!text) return undefined;
  const out: PinNotes = {};
  const rest: string[] = [];
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^(address|addr|location|phone|tel|telephone|website|web|site|url)\s*[:\-]\s*(.+)$/i);
    const k = m?.[1].toLowerCase();
    if (m && k && /^(address|addr|location)$/.test(k)) out.address = m[2].trim();
    else if (m && k && /^(phone|tel|telephone)$/.test(k)) out.phone = m[2].trim();
    else if (m && k) out.website = m[2].trim();
    else rest.push(line);
  }
  if (rest.length) out.text = rest.join('\n').slice(0, 1000);
  return out;
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Parses the My Maps KML: one Folder per state, one Placemark per venue. */
export function parseVenuesKml(kml: string): Venue[] {
  const out: Venue[] = [];
  const seen = new Set<string>();
  for (const folder of kml.split('<Folder>').slice(1)) {
    const state = decode(folder.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? 'Other');
    for (const pm of folder.split('<Placemark>').slice(1)) {
      const name = decode(pm.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? '');
      const coords = pm.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/);
      if (!name || !coords) continue;
      const style = pm.match(/<styleUrl>#icon-(\d+)-([0-9A-Fa-f]{6})/);
      const desc = pm.match(/<description>([\s\S]*?)<\/description>/)?.[1];
      const pin = desc ? parsePinDescription(decode(desc)) : undefined;
      const lng = Number(coords[1]), lat = Number(coords[2]);
      let id = `${slug(state)}--${slug(name)}`;
      if (seen.has(id)) id = `${id}--${lat.toFixed(4)},${lng.toFixed(4)}`;
      seen.add(id);
      out.push({ id, name, state, lat, lng, color: `#${(style?.[2] ?? '757575').toUpperCase()}`, icon: style?.[1] === '1899' ? 'pin' : 'letter', ...(pin ? { pin } : {}) });
    }
  }
  return out;
}

/** The venues on the Google map, cached 10 minutes (changes in Google show up within that). */
export async function loadVenues(fresh = false): Promise<Venue[]> {
  const load = async () => {
    const res = await fetch(`https://www.google.com/maps/d/kml?mid=${VENUES_MAP_ID}&forcekml=1`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Google My Maps answered ${res.status}`);
    const venues = parseVenuesKml(await res.text());
    if (!venues.length) throw new Error('The Google map has no venues (is it still shared “anyone with the link”?)');
    // Last good copy, so the list still works if Google is slow or the map's sharing changes.
    await setJSON(SNAPSHOT_KEY, { at: Date.now(), venues }).catch(() => null);
    return venues;
  };
  return fresh ? load() : cached(`venues:kml:${VENUES_MAP_ID}`, 600, load);
}

const SNAPSHOT_KEY = `venues:snapshot:${VENUES_MAP_ID}`;

/** The Google venues, or the last saved copy (with its date) when Google can't be read right now. */
export async function loadVenuesSafe(fresh = false): Promise<{ venues: Venue[]; staleSince?: number; error?: string }> {
  try {
    return { venues: await loadVenues(fresh) };
  } catch (e) {
    const snap = await getJSON<{ at: number; venues: Venue[] } | null>(SNAPSHOT_KEY, null).catch(() => null);
    if (snap?.venues?.length) return { venues: snap.venues, staleSince: snap.at, error: (e as Error).message };
    throw e;
  }
}
