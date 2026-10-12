// Keap is Club Wealth's database, so before a message goes to the assistant the hub reads the relevant
// Keap records (read-only) and attaches them: the contact picked in the task panel, and any contact whose
// email address is in the message. The assistant is told to base facts on this.

import { callKeap, keapConfigured } from '@/lib/integrations/keap/client';
import { contactWithTags, keapMessage, searchContacts } from '@/lib/integrations/keap/contacts';
import type { IntegrationError } from '@/lib/integrations/http';
import type { Person } from '@/config/people';
import { canLookUpKeap } from '@/lib/integrations/keap/access';

const KEAP_WORDS = /\b(keap|infusionsoft|ifs|crm|contacts?|tags?|campaigns?|clients?|leads?|database)\b/i;

const BUDGET_MS = 6000;
const MAX_EMAILS = 3;

type Row = Record<string, unknown>;
const rows = (d: unknown, key: string) => ((d as Row | null)?.[key] as Row[] | undefined) ?? [];
const day = (s: unknown) => (typeof s === 'string' ? s.slice(0, 10) : '');

async function contactBlock(id: number) {
  const [c, notes, emails, tasks] = await Promise.all([
    contactWithTags(id),
    callKeap('notes.list', { contact_id: id, limit: 5 }).catch(() => null),
    callKeap('contacts.emails', { contactId: id, limit: 5 }).catch(() => null),
    callKeap('tasks.list', { contact_id: id, limit: 5 }).catch(() => null),
  ]);
  const lines = [
    `CONTACT #${c.id}: ${c.name} <${c.email ?? 'no email'}>`,
    `  tags: ${c.tags.join(', ') || 'none'}`,
  ];
  const n = rows(notes, 'notes');
  if (n.length) lines.push('  recent notes:', ...n.map((x) => `    - ${day(x.date_created)} ${String(x.title ?? '')}: ${String(x.body ?? '').replace(/\s+/g, ' ').slice(0, 300)}`));
  const e = rows(emails, 'emails');
  if (e.length) lines.push('  recent emails:', ...e.map((x) => `    - ${day(x.sent_date)} "${String(x.subject ?? '')}"`));
  const t = rows(tasks, 'tasks');
  if (t.length) lines.push('  tasks:', ...t.map((x) => `    - ${String(x.title ?? '')}${x.due_date ? ` (due ${day(x.due_date)})` : ''}${x.completed ? ' [done]' : ''}`));
  return lines.join('\n');
}

/** A small live overview of Keap for general questions: the account, newest contacts, tags and campaigns. */
async function snapshot() {
  const [profile, contacts, tags, campaigns] = await Promise.all([
    callKeap('account.profile', {}).catch((e) => e as IntegrationError),
    callKeap('contacts.list', { limit: 5, order: 'date_created', order_direction: 'descending' }).catch((e) => e as IntegrationError),
    callKeap('tags.list', { limit: 1 }).catch((e) => e as IntegrationError),
    callKeap('campaigns.list', { limit: 10 }).catch((e) => e as IntegrationError),
  ]);
  const failed = [profile, contacts, tags, campaigns].find((r) => r instanceof Error) as IntegrationError | undefined;
  if (failed && [profile, contacts, tags, campaigns].every((r) => r instanceof Error)) {
    return [`KEAP COULDN'T BE READ: ${keapMessage(failed)} (status ${failed.status ?? 'unknown'})`];
  }
  const lines = ['KEAP OVERVIEW:'];
  if (!(profile instanceof Error)) lines.push(`  account: ${String((profile as Row)?.name ?? '')} ${(profile as Row)?.email ? `<${String((profile as Row).email)}>` : ''}`.trimEnd());
  if (!(contacts instanceof Error)) {
    lines.push(`  contacts in Keap: ${String((contacts as Row)?.count ?? 'unknown')}`, '  newest contacts:');
    for (const c of rows(contacts, 'contacts')) {
      const email = (c.email_addresses as Row[] | undefined)?.[0]?.email;
      lines.push(`    - #${String(c.id)} ${[c.given_name, c.family_name].filter(Boolean).join(' ') || '(no name)'}${email ? ` <${String(email)}>` : ''} · added ${day(c.date_created)}`);
    }
  }
  if (!(tags instanceof Error)) lines.push(`  tags in Keap: ${String((tags as Row)?.count ?? 'unknown')}`);
  if (!(campaigns instanceof Error)) {
    const cs = rows(campaigns, 'campaigns');
    lines.push(`  campaigns (${String((campaigns as Row)?.count ?? cs.length)}):`, ...cs.map((c) => `    - ${String(c.name)} · ${String(c.published_status ?? '')} · ${String(c.active_contact_count ?? 0)} active`));
  }
  if (failed) lines.push(`  (part of Keap couldn't be read: ${keapMessage(failed)})`);
  return lines;
}

async function gather(message: string, contactId?: number) {
  const parts: string[] = [];
  if (contactId) parts.push(await contactBlock(contactId).catch(() => `CONTACT #${contactId}: couldn't be read from Keap`));
  const emails = [...new Set((message.match(/[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}/gi) ?? []).map((e) => e.toLowerCase()))].slice(0, MAX_EMAILS);
  for (const email of emails) {
    const found = await searchContacts(email).catch(() => null);
    if (!found) parts.push(`${email}: Keap lookup failed`);
    else if (!found.length) parts.push(`${email}: no contact with this email in Keap`);
    else for (const f of found.slice(0, 2)) if (f.id !== contactId) parts.push(await contactBlock(f.id).catch(() => `CONTACT #${f.id}: ${f.name}`));
  }
  // General Keap questions (no specific contact): a live overview.
  if (!parts.length && KEAP_WORDS.test(message)) parts.push(...(await snapshot()));
  return parts;
}

/** A text block for the assistant, or '' when Keap isn't connected or nothing applies. */
export async function keapContext(user: Person, message: string, contactId?: number): Promise<string> {
  if (!keapConfigured() || !canLookUpKeap(user)) return '';
  const timeout = new Promise<string[]>((resolve) => setTimeout(() => resolve(['(Keap lookup took too long and was skipped)']), BUDGET_MS));
  const parts = await Promise.race([gather(message, contactId), timeout]);
  if (!parts.length) return '';
  return `\n\nFROM KEAP (Club Wealth's database, read live just now; treat as the source of truth):\n${parts.join('\n')}`;
}
