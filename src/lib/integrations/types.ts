// Shared shapes for every integration (built-in like Keap and Zapier, or ones added in the app).

export type IntegrationId =
  | 'keap' | 'zapier' | 'claude' | 'gmail' | 'google-sheets' | 'google-calendar' | 'slack'
  | 'prospectboss' | 'eventbrite' | 'meta' | 'canva' | 'timedoctor' | 'wise' | 'aws' | 'outlook' | 'turbodial' | 'zoom';

export type ConnectionStatus = 'connected' | 'not_connected' | 'planned';

export interface IntegrationInfo {
  id: IntegrationId | string;
  name: string;
  description: string;
  /** Built-in integrations ship with code; custom ones are added by a super admin in the app. */
  kind: 'builtin' | 'custom' | 'planned';
  status: ConnectionStatus;
  /** Env var(s) that turn it on, shown to admins on the Integrations page. */
  envKeys?: string[];
}

/** A custom integration added in the app (webhook or simple REST API). Secrets never go back to the browser. */
export interface CustomIntegration {
  id: string;
  name: string;
  type: 'webhook' | 'rest_api';
  url: string;
  description?: string;
  authHeader?: string;
  /** Stored server-side only. */
  secret?: string;
  createdBy: string;
  createdAt: string;
}

export type PublicCustomIntegration = Omit<CustomIntegration, 'secret'> & { hasSecret: boolean };
