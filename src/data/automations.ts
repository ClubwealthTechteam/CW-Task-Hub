// The automation catalog: every request from the CW AI AUDIT sheet becomes one automation,
// owned by a person and filed under their department. Most are skeletons until they are built.

import audit from './audit.json';
import { PEOPLE } from '@/config/people';
import type { DepartmentId } from '@/config/departments';
import type { IntegrationId } from '@/lib/integrations/types';

export type Stage = 'skeleton' | 'building' | 'live';

export interface AuditItem {
  n: number;
  request: string;
  automation: string;
  integration: string;
  difficulty: string;
  recommendation: string;
  requested: string;
  status: string;
}

export interface Automation {
  id: string;
  /** Request number in the person's audit tab (1–10). */
  n?: number;
  ownerId: string;
  department: DepartmentId;
  title: string;
  summary: string;
  integrationNote: string;
  integrations: IntegrationId[];
  difficulty: string;
  recommendation: string;
  requested: boolean;
  auditStatus: string;
  stage: Stage;
  /** Where it runs today, for automations that already work outside the hub. */
  runsIn?: string;
  /** Where the task came from: the CW AI AUDIT sheet, the Workflow Process Form, or already live. */
  source?: 'audit' | 'form' | 'live';
  /** Build plan (form tasks): each step, the tool, and whether the hub reads, drafts, or needs approval. */
  plan?: PlanStep[];
  /** Form tasks: the person's ideal automated version, in their words. */
  ideal?: string;
  /** Form tasks: how long it takes by hand, as they wrote it. */
  manualTime?: string;
  submissionId?: string;
}

export type PlanMode = 'read' | 'draft' | 'approval' | 'assist';
export interface PlanStep { tool: string; action: string; mode: PlanMode; branches?: string[] }

// Which tools a request needs, read from the "App / Integration Required" and request text.
export const TOOL_HINTS: [RegExp, IntegrationId][] = [
  [/\b(keap|ifs|infusionsoft|crm)\b/i, 'keap'],
  [/zapier/i, 'zapier'],
  [/eventbrite/i, 'eventbrite'],
  [/gmail|\bemail/i, 'gmail'],
  [/outlook|microsoft calendar/i, 'outlook'],
  [/turbo ?dial/i, 'turbodial'],
  [/\bzoom\b/i, 'zoom'],
  [/sheet|spreadsheet|tracker/i, 'google-sheets'],
  [/calendar/i, 'google-calendar'],
  [/prospect ?boss|\bPB\b/, 'prospectboss'],
  [/slack/i, 'slack'],
  [/buildium|propert(y|ies)|contractor|maintenance|tenant/i, 'buildium'],
  [/facebook|meta\b|instagram|threads|social/i, 'meta'],
  [/canva|graphic/i, 'canva'],
  [/time doctor|payroll/i, 'timedoctor'],
  [/\bwise\b/i, 'wise'],
  [/aws|server|infrastructure/i, 'aws'],
];

export function detectIntegrations(...texts: string[]): IntegrationId[] {
  const text = texts.join(' ');
  const found = new Set<IntegrationId>(['claude']);
  for (const [re, id] of TOOL_HINTS) if (re.test(text)) found.add(id);
  return [...found];
}

const AUDIT = audit as Record<string, AuditItem[]>;

const fromAudit: Automation[] = PEOPLE.flatMap((person) => {
  if (!person.auditKey) return [];
  const dept = person.departments[0];
  return (AUDIT[person.auditKey] ?? []).map((item): Automation => ({
    id: `${person.id}-${item.n}`,
    n: item.n,
    ownerId: person.id,
    department: dept,
    title: item.request,
    summary: item.automation,
    integrationNote: item.integration,
    integrations: detectIntegrations(item.request, item.automation, item.integration),
    difficulty: item.difficulty || 'Unrated',
    recommendation: item.recommendation,
    requested: /^yes$/i.test(item.requested),
    auditStatus: item.status || 'No status yet',
    stage: 'skeleton',
    source: 'audit',
  }));
});

// Automations that already run outside the hub. The hub shows them and links out.
const live: Automation[] = [
  {
    id: 'ali-halfday-attendance',
    ownerId: 'ali',
    department: 'events',
    title: 'Half-Day attendance + Stat Sheet',
    summary:
      'Tara posts the Acrobat sign-in link in Slack; Claude extracts attendance into the sheet, Ali matches and finalizes, and Claude posts the Stat Sheet summary.',
    integrationNote: 'Slack, Adobe Acrobat, Google Sheets, Zapier, Claude routine',
    integrations: ['claude', 'slack', 'google-sheets', 'zapier'],
    difficulty: 'Medium',
    recommendation: 'Live. About 85–90% of the manual process is automated.',
    requested: true,
    auditStatus: 'Completed',
    stage: 'live',
    runsIn: 'Claude routine + Zapier (#half-day-registration-forms)',
    source: 'live',
  },
];

export const AUTOMATIONS: Automation[] = [...live, ...fromAudit];

export const automationById = (id: string) => AUTOMATIONS.find((a) => a.id === id);
export const automationsFor = (dept: DepartmentId) => AUTOMATIONS.filter((a) => a.department === dept);
export const automationsOwnedBy = (personId: string) => AUTOMATIONS.filter((a) => a.ownerId === personId);
