// Eventbrite views the hub can read (https://www.eventbrite.com/platform/api). View-only: GET requests only.
// Paging: Eventbrite returns { pagination: { has_more_items, continuation } }; pass continuation back.

import type { HttpMethod } from '../keap/capabilities';

export interface EventbriteCapability { id: string; group: string; label: string; method: HttpMethod; path: string; hint?: string }

export const EVENTBRITE_CAPABILITIES: EventbriteCapability[] = [
  { id: 'me', group: 'Account', label: 'Signed-in account', method: 'GET', path: '/v3/users/me/' },
  { id: 'organizations', group: 'Account', label: 'Organizations', method: 'GET', path: '/v3/users/me/organizations/' },
  { id: 'events.list', group: 'Events', label: 'Events', method: 'GET', path: '/v3/organizations/{organizationId}/events/', hint: 'status=live|started|ended|draft|all, time_filter=current_future|past, order_by=start_asc|start_desc' },
  { id: 'events.get', group: 'Events', label: 'One event', method: 'GET', path: '/v3/events/{eventId}/', hint: 'expand=venue,ticket_availability' },
  { id: 'events.ticket_classes', group: 'Events', label: 'Ticket types', method: 'GET', path: '/v3/events/{eventId}/ticket_classes/' },
  { id: 'events.attendees', group: 'Events', label: 'Attendees', method: 'GET', path: '/v3/events/{eventId}/attendees/', hint: 'status=attending|not_attending|unpaid' },
  { id: 'events.orders', group: 'Events', label: 'Orders', method: 'GET', path: '/v3/events/{eventId}/orders/' },
  { id: 'events.questions', group: 'Events', label: 'Checkout questions', method: 'GET', path: '/v3/events/{eventId}/questions/' },
  { id: 'venues.list', group: 'Organization', label: 'Venues', method: 'GET', path: '/v3/organizations/{organizationId}/venues/' },
  { id: 'webhooks.list', group: 'Organization', label: 'Webhooks', method: 'GET', path: '/v3/organizations/{organizationId}/webhooks/' },
];

export const eventbriteCapability = (id: string) => EVENTBRITE_CAPABILITIES.find((c) => c.id === id);
