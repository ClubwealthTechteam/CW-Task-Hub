// What the department workspace shows beside a task: the steps that happen once a person approves a draft,
// and which tool does each one. Real actions replace these as each automation is built.

import type { Automation } from '@/data/automations';
import { builtinIntegrations, integrationName } from '@/lib/integrations/registry';

export interface ApproveStep { title: string; detail: string; connected: boolean }

const ACTION: Record<string, [string, string]> = {
  keap: ['Update Keap', 'Apply the tag, run the campaign and log a note on the contact'],
  gmail: ['Send the email', 'From your Gmail, after you approve the draft'],
  'google-sheets': ['Update the tracker', 'Write the result into the Google Sheet'],
  'google-calendar': ['Update the calendar', 'Add or change the Google Calendar event'],
  buildium: ['Update Buildium', 'Update the property, work order or contractor record'],
  zapier: ['Run the Zap', 'Start the matching Zapier workflow'],
  slack: ['Post in Slack', 'Share the update in the right channel'],
  prospectboss: ['Update ProspectBoss', 'Update the contact list'],
  meta: ['Schedule the post', 'Queue it on Facebook / Instagram'],
  canva: ['Make the graphic', 'Fill the Canva template'],
};

export function isConnected(id: string) {
  return builtinIntegrations().find((i) => i.id === id)?.status === 'connected';
}

export function approveSteps(a: Automation): ApproveStep[] {
  const tools = a.integrations.filter((id) => id !== 'claude');
  const steps: ApproveStep[] = tools.map((id) => {
    const [title, detail] = ACTION[id] ?? [`Update ${integrationName(id)}`, `Through ${integrationName(id)}`];
    return { title, detail, connected: isConnected(id) };
  });
  steps.push({ title: 'Log it in the hub', detail: 'Saved to the run history with who approved it', connected: true });
  return steps;
}

/** The main tool a task's "Approve" button sends through, e.g. "Keap". */
export function primaryTool(a: Automation) {
  const id = a.integrations.find((t) => t !== 'claude');
  return id ? integrationName(id) : null;
}

/** Suggestion chips under the chat box for a task. */
export function starters(a: Automation): string[] {
  const t = a.title.toLowerCase();
  const out = ['What will this task do?'];
  if (/email|message|reply|follow|communicat|reminder|outreach/.test(t)) out.push('Draft a message for me');
  if (/report|summary|tracker|data|stat/.test(t)) out.push('Help me summarize this week');
  out.push('Walk me through it step by step');
  return out.slice(0, 3);
}

export type TaskIcon = 'chat' | 'card' | 'calendar' | 'megaphone' | 'person' | 'flag' | 'book' | 'table' | 'grid' | 'spark' | 'home' | 'mail';

export function taskIcon(a: Automation): TaskIcon {
  const t = `${a.title} ${a.summary}`.toLowerCase();
  if (/bill|payment|invoice|refund|payroll/.test(t)) return 'card';
  if (/email|inbox|gmail/.test(t)) return 'mail';
  if (/message|reply|communicat|chat|sms/.test(t)) return 'chat';
  if (/calendar|schedul|event|half.?day|venue/.test(t)) return 'calendar';
  if (/post|social|marketing|content|graphic|announce/.test(t)) return 'megaphone';
  if (/follow/.test(t)) return 'flag';
  if (/client|contact|lead|recruit|people|staff/.test(t)) return 'person';
  if (/knowledge|sop|guide|training|course/.test(t)) return 'book';
  if (/report|tracker|sheet|data|stat|list/.test(t)) return 'table';
  if (/propert|tenant|maintenance|contractor|buildium/.test(t)) return 'home';
  if (/update|internal/.test(t)) return 'grid';
  return 'spark';
}
