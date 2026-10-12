// The list of integrations shown on the Integrations page and used by automations.

import { keapConfigured } from './keap/client';
import { buildiumConfigured } from './buildium/client';
import { zapierHooks } from './zapier';
import { eventbriteConfigured } from './eventbrite/client';
import type { IntegrationId, IntegrationInfo } from './types';

const PLANNED: Record<string, string> = {
  gmail: 'Gmail', 'google-sheets': 'Google Sheets', 'google-calendar': 'Google Calendar', slack: 'Slack',
  prospectboss: 'ProspectBoss', meta: 'Meta (Facebook / Instagram)', canva: 'Canva', timedoctor: 'Time Doctor',
  wise: 'Wise', aws: 'AWS', outlook: 'Outlook & Microsoft Calendar', turbodial: 'Turbo Dial', zoom: 'Zoom',
};

export function builtinIntegrations(): IntegrationInfo[] {
  return [
    {
      id: 'keap', name: 'Keap', kind: 'builtin', envKeys: ['KEAP_API_KEY'],
      description: 'Contacts, tags, campaigns and API goals, emails, notes, tasks, sales records and webhooks.',
      status: keapConfigured() ? 'connected' : 'not_connected',
    },
    {
      id: 'buildium', name: 'Buildium', kind: 'builtin', envKeys: ['BUILDIUM_CLIENT_ID', 'BUILDIUM_CLIENT_SECRET'],
      description: 'Properties, units, work orders, resident requests, contractors (vendors), bills and leases.',
      status: buildiumConfigured() ? 'connected' : 'not_connected',
    },
    {
      id: 'zapier', name: 'Zapier', kind: 'builtin', envKeys: ['ZAPIER_HOOKS'],
      description: 'Start any Zap from the hub through its Catch Hook URL.',
      status: Object.keys(zapierHooks()).length ? 'connected' : 'not_connected',
    },
    {
      id: 'eventbrite', name: 'Eventbrite', kind: 'builtin', envKeys: ['EVENTBRITE_TOKEN'],
      description: 'View-only: events, ticket types, attendees, orders and venues.',
      status: eventbriteConfigured() ? 'connected' : 'not_connected',
    },
    {
      id: 'claude', name: 'Claude', kind: 'builtin', envKeys: ['ANTHROPIC_API_KEY'],
      description: 'Writing, summarizing, extracting and deciding steps inside automations.',
      status: process.env.ANTHROPIC_API_KEY ? 'connected' : 'not_connected',
    },
  ];
}

export function plannedIntegrations(): IntegrationInfo[] {
  return Object.entries(PLANNED).map(([id, name]) => ({
    id, name, kind: 'planned', status: 'planned',
    description: 'Needed by some automations. Add it here as a custom integration, or ask Miguel to build it in.',
  }));
}

export const integrationName = (id: IntegrationId | string) =>
  ({ keap: 'Keap', buildium: 'Buildium', eventbrite: 'Eventbrite', zapier: 'Zapier', claude: 'Claude' } as Record<string, string>)[id] ?? PLANNED[id] ?? id;
