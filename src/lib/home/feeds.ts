// Read-only feeds for the team member home page: the newest Keap contacts and Club Wealth's upcoming
// Eventbrite events. Shared by everyone and cached briefly so the page stays fast and Keap isn't asked
// on every visit.

import { cached } from '@/lib/store';
import { callKeap, keapConfigured } from '@/lib/integrations/keap/client';
import { callEventbrite, eventbriteConfigured } from '@/lib/integrations/eventbrite/client';

export interface NewContact { id: number; name: string; email: string | null; created: string | null }
export interface UpcomingEvent { id: string; name: string; start: string | null; where: string; sold: number | null; capacity: number | null; url: string | null }
export type Feed<T> = { ok: true; items: T[] } | { ok: false; reason: 'not-connected' | 'error' };

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function newKeapContacts(limit = 8): Promise<Feed<NewContact>> {
  if (!keapConfigured()) return { ok: false, reason: 'not-connected' };
  try {
    const items = await cached('home:keap-new', 5 * 60, async () => {
      const body = (await callKeap('contacts.list', { order: 'date_created', order_direction: 'DESCENDING', limit: 12 })) as Row;
      return ((body?.contacts ?? []) as Row[]).map((c) => ({
        id: c.id,
        name: [c.given_name, c.family_name].filter(Boolean).join(' ') || '(no name)',
        email: c.email_addresses?.find((e: Row) => e.field === 'EMAIL1')?.email ?? c.email_addresses?.[0]?.email ?? null,
        created: c.date_created ?? null,
      })) as NewContact[];
    });
    return { ok: true, items: items.slice(0, limit) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function upcomingEvents(limit = 6): Promise<Feed<UpcomingEvent>> {
  if (!eventbriteConfigured()) return { ok: false, reason: 'not-connected' };
  try {
    const items = await cached('home:events-upcoming', 10 * 60, async () => {
      const list = (await callEventbrite('events.list', { time_filter: 'current_future', status: 'live,started', order_by: 'start_asc', expand: 'venue', page_size: 8 })) as Row;
      const events: Row[] = (list?.events ?? []).slice(0, 8);
      return Promise.all(events.map(async (e) => {
        const t = (await callEventbrite('events.ticket_classes', { eventId: e.id }).catch(() => null)) as Row | null;
        const tickets: Row[] = t?.ticket_classes ?? [];
        return {
          id: String(e.id),
          name: e.name?.text ?? 'Untitled event',
          start: e.start?.local ?? null,
          where: [e.venue?.name, e.venue?.address?.city].filter(Boolean).join(', ') || (e.online_event ? 'Online' : 'Venue not set'),
          sold: t ? tickets.reduce((n, x) => n + (x.quantity_sold ?? 0), 0) : null,
          capacity: t ? tickets.reduce((n, x) => n + (x.quantity_total ?? 0), 0) || null : null,
          url: e.url ?? null,
        } as UpcomingEvent;
      }));
    });
    return { ok: true, items: items.slice(0, limit) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
