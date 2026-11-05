// Eventbrite events held at a venue (past and upcoming), matched by location: an event whose Eventbrite
// venue is within ~400 m of the pin, or whose venue name matches. Read-only, cached 30 minutes.

import { cached } from '@/lib/store';
import { callEventbrite, eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import type { Venue } from './map';

export interface VenueEvent { id: string; name: string; start: string; status: string; url: string; capacity?: number; sold?: number; venueName?: string }
interface EbEvent {
  id: string; name?: { text?: string }; start?: { local?: string }; status?: string; url?: string; capacity?: number;
  venue?: { name?: string; latitude?: string; longitude?: string } | null;
  ticket_availability?: { quantity_sold?: number } | null;
}

const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180, x = (bLng - aLng) * r * Math.cos(((aLat + bLat) / 2) * r), y = (bLat - aLat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

async function allEvents(): Promise<EbEvent[]> {
  return cached('venues:eventbrite:events', 1800, async () => {
    const out: EbEvent[] = [];
    let continuation: string | undefined;
    for (let page = 0; page < 15; page++) {
      const body = (await callEventbrite('events.list', {
        status: 'all', order_by: 'start_desc', expand: 'venue,ticket_availability', page_size: 200, ...(continuation ? { continuation } : {}),
      })) as { events?: EbEvent[]; pagination?: { has_more_items?: boolean; continuation?: string } };
      out.push(...(body.events ?? []).map((e) => ({
        id: e.id, name: { text: e.name?.text }, start: { local: e.start?.local }, status: e.status, url: e.url, capacity: e.capacity,
        venue: e.venue ? { name: e.venue.name, latitude: e.venue.latitude, longitude: e.venue.longitude } : null,
        ticket_availability: e.ticket_availability ? { quantity_sold: e.ticket_availability.quantity_sold } : null,
      })));
      if (!body.pagination?.has_more_items || !body.pagination.continuation) break;
      continuation = body.pagination.continuation;
    }
    return out;
  });
}

export async function eventsAtVenue(v: Venue): Promise<{ connected: boolean; events: VenueEvent[] }> {
  if (!eventbriteConfigured()) return { connected: false, events: [] };
  const name = norm(v.name);
  const events = (await allEvents()).filter((e) => {
    const lat = Number(e.venue?.latitude), lng = Number(e.venue?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && km(v.lat, v.lng, lat, lng) < 0.4) return true;
    const vn = norm(e.venue?.name);
    return Boolean(vn) && vn.length > 6 && (vn === name || name.includes(vn) || vn.includes(name));
  });
  return {
    connected: true,
    events: events.map((e) => ({
      id: e.id, name: e.name?.text ?? 'Event', start: e.start?.local ?? '', status: e.status ?? '', url: e.url ?? '',
      capacity: e.capacity, sold: e.ticket_availability?.quantity_sold, venueName: e.venue?.name,
    })),
  };
}
