// Runs an automation. Skeletons return a dry-run plan (what they will do and which tools they need);
// built automations register a handler in HANDLERS and do the real work. Every run is logged.

import { automationById, type Automation } from '@/data/automations';
import { builtinIntegrations, integrationName } from '@/lib/integrations/registry';
import { getJSON, setJSON } from '@/lib/store';
import type { Person } from '@/config/people';

export interface RunInput { notes?: string; [key: string]: unknown }

export interface RunResult {
  automationId: string;
  mode: 'dry_run' | 'live';
  ok: boolean;
  message: string;
  steps: { label: string; status: 'ready' | 'waiting' | 'done' | 'skipped'; detail?: string }[];
  output?: unknown;
}

export interface RunLogEntry { at: string; by: string; automationId: string; mode: RunResult['mode']; ok: boolean; message: string }

type Handler = (a: Automation, input: RunInput, user: Person) => Promise<RunResult>;

/** Built automations go here, keyed by automation id. */
const HANDLERS: Record<string, Handler> = {};

function connected(id: string) {
  return builtinIntegrations().find((i) => i.id === id)?.status === 'connected';
}

function dryRun(a: Automation, input: RunInput): RunResult {
  const tools = a.integrations.map((id) => ({
    label: `Connect ${integrationName(id)}`,
    status: connected(id) ? ('ready' as const) : ('waiting' as const),
    detail: connected(id) ? 'Connected' : 'Not connected yet',
  }));
  const waiting = tools.filter((t) => t.status === 'waiting').length;
  return {
    automationId: a.id,
    mode: 'dry_run',
    ok: true,
    message: a.stage === 'live'
      ? `This automation already runs in ${a.runsIn}. Nothing to run here.`
      : `Skeleton only: this shows the plan. ${waiting ? `${waiting} tool${waiting > 1 ? 's' : ''} still need${waiting > 1 ? '' : 's'} connecting.` : 'All tools are connected; the steps still need building.'}`,
    steps: [
      { label: 'Read the request', status: 'done', detail: input.notes ? `Notes: ${String(input.notes).slice(0, 200)}` : 'No notes given' },
      ...tools,
      { label: a.summary, status: 'waiting', detail: 'To be built from the Workflow Process Form map' },
      { label: 'Human review before anything is sent or changed', status: 'waiting' },
    ],
  };
}

export async function runAutomation(id: string, input: RunInput, user: Person): Promise<RunResult> {
  const a = automationById(id);
  if (!a) throw new Error('Automation not found');
  const handler = HANDLERS[id];
  const result = handler ? await handler(a, input, user) : dryRun(a, input);
  await logRun({ at: new Date().toISOString(), by: user.id, automationId: id, mode: result.mode, ok: result.ok, message: result.message });
  return result;
}

const LOG_KEY = 'runs:log';
export const listRuns = () => getJSON<RunLogEntry[]>(LOG_KEY, []);
async function logRun(entry: RunLogEntry) {
  const all = await listRuns();
  await setJSON(LOG_KEY, [entry, ...all].slice(0, 500));
}
