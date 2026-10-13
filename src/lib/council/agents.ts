// The CW Hub Council: six AI agents that check the hub every day. They only read and advise; nothing in
// Keap or any other system is changed, and hub clean-ups wait for a super admin to press Apply.

export const AGENTS = [
  { id: 'inspector', name: 'Bug & Integration Inspector', short: 'Inspector', icon: '🛠️', job: 'Finds bugs and checks every integration connection (Keap, Eventbrite, Google Sheets, Zapier, the assistant, storage).' },
  { id: 'fact-checker', name: 'Accuracy Checker', short: 'Fact checker', icon: '🔎', job: 'Checks that what the hub and the assistant say matches Keap: names, businesses, cities, coaches and client facts.' },
  { id: 'engineer', name: 'Senior Developer & Systems Engineer', short: 'Engineer', icon: '🧑‍💻', job: 'Reviews the backend: code health, build, security, performance, configuration and recent changes.' },
  { id: 'secretary', name: 'Database Secretary', short: 'Secretary', icon: '🗂️', job: 'Keeps the hub’s data organized: inventory, duplicates, stale or orphaned records, and tidy-up proposals.' },
  { id: 'compliance', name: 'Compliance Guard', short: 'Compliance', icon: '🛡️', job: 'Checks that AI conversations stay on Club Wealth work, and flags sensitive data or misuse.' },
  { id: 'strategist', name: 'Strategist', short: 'Strategist', icon: '♟️', job: 'For anything failing or stopped, gives the best alternatives and workarounds so work can continue.' },
] as const;

export type AgentId = typeof AGENTS[number]['id'];
export type Level = 'ok' | 'warn' | 'fail';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
  evidence?: string;
  recommendation?: string;
  area?: string;
}

export interface AgentReport { id: AgentId; status: Level; summary: string; findings: Finding[] }

/** Clean-ups the Database Secretary can propose; a super admin applies them. Hub data only, never Keap. */
export const ACTIONS = {
  'remove-closed-referrals': 'Remove referral opportunities that were closed more than 60 days ago',
  'remove-old-background-chats': 'Delete background chats (graphics, finders) older than 30 days',
  'dedupe-calendar': 'Remove exact duplicate posts on the content calendar (same title, date and time)',
  'clear-failed-batches': 'Clear referral batches that failed more than 7 days ago',
} as const;
export type ActionId = keyof typeof ACTIONS;

export interface Proposal { id: string; action: ActionId; why: string; status: 'open' | 'applied' | 'dismissed'; result?: string; by?: string; at?: number }

export interface Report {
  runId: string;
  at: number;
  overall: Level;
  headline: string;
  agents: AgentReport[];
  proposals: Proposal[];
}

export interface Run { id: string; at: number; by: string; status: 'running' | 'done' | 'error'; error?: string; finishedAt?: number }
