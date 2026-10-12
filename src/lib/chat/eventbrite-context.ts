// For event questions, attach Club Wealth's upcoming Eventbrite events (read-only) to the assistant's
// message: dates, venues and tickets sold, so answers about events use live numbers.

import type { Person } from '@/config/people';
import { callEventbrite, eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';

const BUDGET_MS = 6000;
const MAX_EVENTS = 8;
const EVENT_WORDS = /\b(event|events|half[- ]?day|registr|attendee|attendance|ticket|rsvp|venue|seminar|workshop|boot ?camp|mastermind|eventbrite)/i;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function gather() {
  const list = (await callEventbrite('events.list', { time_filter: 'current_future', status: 'live,started', order_by: 'start_asc', expand: 'venue', page_size: MAX_EVENTS })) as Row;
  const events: Row[] = (list.events ?? []).slice(0, MAX_EVENTS);
  const lines = await Promise.all(events.map(async (e) => {
    const t = (await callEventbrite('events.ticket_classes', { eventId: e.id }).catch(() => null)) as Row | null;
    const tickets: Row[] = t?.ticket_classes ?? [];
    const sold = tickets.reduce((n, x) => n + (x.quantity_sold ?? 0), 0);
    const total = tickets.reduce((n, x) => n + (x.quantity_total ?? 0), 0);
    const where = [e.venue?.name, e.venue?.address?.city].filter(Boolean).join(', ') || (e.online_event ? 'online' : 'venue not set');
    return `- ${e.start?.local?.replace('T', ' ').slice(0, 16)} · ${e.name?.text} · ${where} · ${t ? `${sold} sold${total ? ` of ${total}` : ''}` : 'tickets unknown'} · ${e.status} · eventbrite id ${e.id}`;
  }));
  return lines;
}

/** A text block for the assistant, or '' when it doesn't apply. */
export async function eventbriteContext(user: Person, message: string, eventTask: boolean): Promise<string> {
  if (!eventbriteConfigured() || !canViewEventbrite(user)) return '';
  if (!eventTask && !EVENT_WORDS.test(message)) return '';
  const timeout = new Promise<string[] | null>((resolve) => setTimeout(() => resolve(null), BUDGET_MS));
  const lines = await Promise.race([gather().catch(() => null), timeout]);
  if (!lines) return '\n\nFROM EVENTBRITE: (couldn’t be read just now)';
  return `\n\nFROM EVENTBRITE (Club Wealth's upcoming events, read live just now):\n${lines.join('\n') || '- no upcoming live events'}`;
}
