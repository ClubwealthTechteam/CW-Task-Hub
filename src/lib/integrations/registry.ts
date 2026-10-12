// The list of integrations shown on the Integrations page and used by automations.

import { keapConfigured } from './keap/client';
import { zapierHooks } from './zapier';
import type { IntegrationId, IntegrationInfo } from './types';

const PLANNED: Record<string, string> = {
  gmail: 'Gmail', 'google-sheets': 'Google Sheets', 'google-calendar': 'Google Calendar', slack: 'Slack',
  prospectboss: 'ProspectBoss', buildium: 'Buildium (properties, contractors, maintenance)', meta: 'Meta (Facebook / Instagram)', canva: 'Canva', timedoctor: 'Time Doctor',
  wise: 'Wise', aws: 'AWS', recruitcrm: 'Recruit CRM',
};

export function builtinIntegrations(): IntegrationInfo[] {
  return [
    {
      id: 'keap', name: 'Keap', kind: 'builtin', envKeys: ['KEAP_API_KEY'],
      description: 'Contacts, tags, campaigns and API goals, emails, notes, tasks, sales records and webhooks.',
      status: keapConfigured() ? 'connected' : 'not_connected',
    },
    {
      id: 'zapier', name: 'Zapier', kind: 'builtin', envKeys: ['ZAPIER_HOOKS'],
      description: 'Start any Zap from the hub through its Catch Hook URL.',
      status: Object.keys(zapierHooks()).length ? 'connected' : 'not_connected',
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
  ({ keap: 'Keap', zapier: 'Zapier', claude: 'Claude' } as Record<string, string>)[id] ?? PLANNED[id] ?? id;
