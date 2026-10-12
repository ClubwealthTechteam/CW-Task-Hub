// Every Keap feature the hub can call, as an allowlist. The API route only runs actions listed here.
// Paths follow the Keap REST API (https://developer.keap.com/docs/rest/). {param} parts are filled
// from the request; everything else goes in the query string (GET) or JSON body (other methods).

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface KeapCapability {
  id: string;
  group: string;
  label: string;
  method: HttpMethod;
  path: string;
  /** Short note for admins: what it is for in Club Wealth's workflows. */
  hint?: string;
  /** Changes data in Keap (create, update, delete, send, start automation). */
  writes?: boolean;
}

export const KEAP_CAPABILITIES: KeapCapability[] = [
  // Contacts
  { id: 'contacts.list', group: 'Contacts', label: 'Find contacts', method: 'GET', path: '/v1/contacts', hint: 'Filter by email, given_name, family_name; limit/offset' },
  { id: 'contacts.get', group: 'Contacts', label: 'Get a contact', method: 'GET', path: '/v1/contacts/{contactId}' },
  { id: 'contacts.create', group: 'Contacts', label: 'Create a contact', method: 'POST', path: '/v1/contacts', writes: true },
  { id: 'contacts.upsert', group: 'Contacts', label: 'Create or update a contact', method: 'PUT', path: '/v1/contacts', writes: true, hint: 'Use duplicate_option: "Email"' },
  { id: 'contacts.update', group: 'Contacts', label: 'Update a contact', method: 'PATCH', path: '/v1/contacts/{contactId}', writes: true },
  { id: 'contacts.delete', group: 'Contacts', label: 'Delete a contact', method: 'DELETE', path: '/v1/contacts/{contactId}', writes: true },

  // Tags (applying a tag is how most Keap automations start)
  { id: 'tags.list', group: 'Tags', label: 'List tags', method: 'GET', path: '/v1/tags' },
  { id: 'tags.contacts', group: 'Tags', label: 'Contacts with a tag', method: 'GET', path: '/v1/tags/{tagId}/contacts' },
  { id: 'contacts.tags.list', group: 'Tags', label: "A contact's tags", method: 'GET', path: '/v1/contacts/{contactId}/tags' },
  { id: 'contacts.tags.apply', group: 'Tags', label: 'Apply tags to a contact', method: 'POST', path: '/v1/contacts/{contactId}/tags', writes: true, hint: 'Body: { "tagIds": [123] }. Starts any campaign that listens for the tag.' },
  { id: 'contacts.tags.remove', group: 'Tags', label: 'Remove a tag from a contact', method: 'DELETE', path: '/v1/contacts/{contactId}/tags/{tagId}', writes: true },

  // Campaigns / automations
  { id: 'campaigns.list', group: 'Campaigns & automations', label: 'List campaigns', method: 'GET', path: '/v1/campaigns' },
  { id: 'campaigns.get', group: 'Campaigns & automations', label: 'Get a campaign (with sequences)', method: 'GET', path: '/v1/campaigns/{campaignId}', hint: 'Add optional_properties=sequences' },
  { id: 'campaigns.sequence.add', group: 'Campaigns & automations', label: 'Add a contact to a campaign sequence', method: 'POST', path: '/v1/campaigns/{campaignId}/sequences/{sequenceId}/contacts/{contactId}', writes: true },
  { id: 'campaigns.sequence.remove', group: 'Campaigns & automations', label: 'Remove a contact from a sequence', method: 'DELETE', path: '/v1/campaigns/{campaignId}/sequences/{sequenceId}/contacts/{contactId}', writes: true },
  { id: 'campaigns.goal.achieve', group: 'Campaigns & automations', label: 'Trigger an API goal', method: 'POST', path: '/v1/campaigns/goals/{integration}/{callName}', writes: true, hint: 'Body: { "contact_id": 123 }. The cleanest "shortcut" into a Campaign Builder automation.' },
  { id: 'automations.list', group: 'Campaigns & automations', label: 'List automations (v2)', method: 'GET', path: '/v2/automations' },

  // Email
  { id: 'emails.list', group: 'Email', label: 'Email history', method: 'GET', path: '/v1/emails' },
  { id: 'emails.send', group: 'Email', label: 'Send an email', method: 'POST', path: '/v1/emails/queue', writes: true, hint: 'Keep human approval on anything client-facing' },

  // Notes & tasks
  { id: 'notes.list', group: 'Notes & tasks', label: 'List notes', method: 'GET', path: '/v1/notes' },
  { id: 'notes.create', group: 'Notes & tasks', label: 'Add a note to a contact', method: 'POST', path: '/v1/notes', writes: true },
  { id: 'tasks.list', group: 'Notes & tasks', label: 'List tasks', method: 'GET', path: '/v1/tasks' },
  { id: 'tasks.create', group: 'Notes & tasks', label: 'Create a task', method: 'POST', path: '/v1/tasks', writes: true },
  { id: 'tasks.update', group: 'Notes & tasks', label: 'Update / reassign a task', method: 'PATCH', path: '/v1/tasks/{taskId}', writes: true },

  // Sales
  { id: 'opportunities.list', group: 'Sales', label: 'List opportunities', method: 'GET', path: '/v1/opportunities' },
  { id: 'opportunities.update', group: 'Sales', label: 'Update an opportunity', method: 'PATCH', path: '/v1/opportunities/{opportunityId}', writes: true },
  { id: 'orders.list', group: 'Sales', label: 'List orders', method: 'GET', path: '/v1/orders' },
  { id: 'products.list', group: 'Sales', label: 'List products', method: 'GET', path: '/v1/products' },
  { id: 'subscriptions.list', group: 'Sales', label: 'List subscriptions', method: 'GET', path: '/v1/subscriptions' },
  { id: 'transactions.list', group: 'Sales', label: 'List transactions', method: 'GET', path: '/v1/transactions' },

  // Other records
  { id: 'companies.list', group: 'Other', label: 'List companies', method: 'GET', path: '/v1/companies' },
  { id: 'appointments.list', group: 'Other', label: 'List appointments', method: 'GET', path: '/v1/appointments' },
  { id: 'files.list', group: 'Other', label: 'List files', method: 'GET', path: '/v1/files' },
  { id: 'users.list', group: 'Other', label: 'List Keap users (RMs, staff)', method: 'GET', path: '/v1/users' },
  { id: 'account.profile', group: 'Other', label: 'Account profile', method: 'GET', path: '/v1/account/profile' },

  // Webhooks (Keap calls the hub when something happens)
  { id: 'hooks.list', group: 'Webhooks', label: 'List REST hooks', method: 'GET', path: '/v1/hooks' },
  { id: 'hooks.eventTypes', group: 'Webhooks', label: 'Hook event types', method: 'GET', path: '/v1/hooks/event_keys' },
  { id: 'hooks.create', group: 'Webhooks', label: 'Subscribe to an event', method: 'POST', path: '/v1/hooks', writes: true, hint: 'e.g. contact.tag.applied → the hub' },
];

export const keapCapability = (id: string) => KEAP_CAPABILITIES.find((c) => c.id === id);
