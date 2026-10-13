// Upcoming Club Wealth events from Eventbrite for the content calendar, so event promo posts can be
// planned around them. Read-only, and only the public listing details (name, date, city, link).

import { callEventbrite, eventbriteConfigured } from '@/lib/integrations/eventbrite/client';

export interface CalendarEvent { id: string; name: string; date: string; time?: string; city?: string; url?: string }

const TTL = 10 * 60 * 1000;
let cache: { at: number; events: CalendarEvent[] } | null = null;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function upcomingEvents(): Promise<CalendarEvent[]> {
  if (!eventbriteConfigured()) return [];
  if (cache && Date.now() - cache.at < TTL) return cache.events;
  try {
    const body = (await callEventbrite('events.list', { time_filter: 'current_future', status: 'live,started', order_by: 'start_asc', expand: 'venue', page_size: 50 })) as Row;
    const events: CalendarEvent[] = (body.events ?? []).map((e: Row) => ({
      id: String(e.id),
      name: String(e.name?.text ?? 'Event'),
      date: String(e.start?.local ?? '').slice(0, 10),
      time: String(e.start?.local ?? '').slice(11, 16) || undefined,
      city: e.venue?.address?.city || (e.online_event ? 'Online' : undefined),
      url: e.url,
    })).filter((e: CalendarEvent) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
    cache = { at: Date.now(), events };
    return events;
  } catch {
    return cache?.events ?? [];
  }
}
