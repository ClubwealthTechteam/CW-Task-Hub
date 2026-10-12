// Turns each process in a Workflow Process Form submission into a hub task with a build plan.
// Every step says what the hub would do: read (view-only), draft something for the person to review,
// or a change that needs approval (Keap and other systems stay read-only until writes are approved).

import { PEOPLE } from '@/config/people';
import { detectIntegrations, type Automation, type PlanMode, type PlanStep } from '@/data/automations';
import type { FormProcess, Submission } from './submissions';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);

const CHANGES = /\b(charge (the )?card|process(es|ing)? (the )?(charge|payment)|payments? processed|create (an |the |their )?(order|subscription|task)|update|add (the |necessary )?tags?|apply|remove|delete|merge|book|cancel|reschedul)/i;
const SENDS = /\b(send|email|text reminder|reminder|invitation|invite|outreach|follow[- ]?up|draft|call script|announce|minutes)/i;
const READS = /\b(search|check|open|locate|export|review|find|compare|verify|identify|look|pull|collect|research|monitor|track)/i;
const SYSTEMS = /keap|ifs|prospect ?boss|eventbrite|calendar|canva|drive|sheet|spreadsheet|subscription|order/i;

function modeFor(tool: string, description: string): PlanMode {
  const t = `${tool} ${description}`;
  if (CHANGES.test(description) && SYSTEMS.test(t)) return 'approval';
  if (SENDS.test(description)) return 'draft';
  if (READS.test(description)) return 'read';
  return 'assist';
}

const firstSentence = (s: string) => {
  const clean = s.replace(/^manual process\s*/i, '').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.{20,220}?[.!?])\s/);
  return (m ? m[1] : clean.slice(0, 220)).trim();
};

const MAX_PLAN = 14;

function planFor(p: FormProcess): PlanStep[] {
  const out: PlanStep[] = [];
  for (const s of p.steps) {
    const tool = s.tool.length > 60 || /^https?:/.test(s.tool) ? 'Link' : s.tool || 'Step';
    // A step written as several lines ("Manual Process / Open… / Find…") becomes one plan step per line.
    const lines = s.description.split(/\n+/).map((l) => l.replace(/^\s*(?:\d+\.|[-•])\s*/, '').trim())
      .filter((l) => l && !/^manual process$/i.test(l));
    const parts = lines.length > 1 ? lines : [s.description || s.tool];
    parts.forEach((line, i) => out.push({
      tool,
      action: firstSentence(line),
      mode: modeFor(s.tool, line),
      branches: i === parts.length - 1 ? s.outcomes.filter((o) => o.result).map((o) => `${o.label}: ${o.result}`.slice(0, 240)) : undefined,
    }));
  }
  return out.slice(0, MAX_PLAN);
}

/** "1. Title … 2. Title …" → item text by number, for matching overviews to processes. */
function numbered(overview: string): string[] {
  const parts = overview.split(/(?:^|\n)\s*(?=\d{1,2}\s*\.\s*\S)/);
  return parts.map((p) => p.replace(/^\d{1,2}\s*\.\s*/, '').trim()).filter(Boolean);
}

/** The numbered overview item whose heading best matches a process title (most of the title's words). */
function bestIndex(title: string, items: string[]) {
  const tw = words(title);
  let best = -1, score = 0;
  items.forEach((it, i) => {
    const iw = words(it.split(/\n|\s[-–]\s|:/)[0]);
    const s = [...tw].filter((w) => iw.has(w)).length / Math.max(tw.size, 1);
    if (s > score) { score = s; best = i; }
  });
  return score >= 0.6 ? best : -1;
}

/** Item text without its heading line, e.g. "Exporting AR\n\nI log in…" → "I log in…". */
const body = (item: string, title: string) => {
  const [head, ...rest] = item.split(/\n+/);
  return rest.length && bestIndex(title, [head]) === 0 ? rest.join(' ') : item;
};

const TIME = /(\d+(?:\.\d+)?\s*(?:[–-]|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?|one|two|three)\s*(?:min(?:ute)?s?|hours?|hrs?)\b(?:\s*(?:to|-)\s*\d+\s*(?:hours?|hrs?))?/i;

export function formAutomations(subs: Submission[]): Automation[] {
  const out = new Map<string, Automation>();
  for (const s of subs) {
    const person = PEOPLE.find((p) => p.id === s.personId);
    if (!person) continue;
    const manualItems = numbered(s.manualOverview);
    const idealItems = numbered(s.idealOverview);
    // Some people put later processes under Q7; treat every titled process as one task.
    const byTitle = new Map<string, { manual?: FormProcess; ideal?: FormProcess }>();
    for (const p of s.manualProcesses) if (p.title) byTitle.set(slug(p.title), { ...byTitle.get(slug(p.title)), manual: p });
    for (const p of s.idealProcesses) if (p.title) byTitle.set(slug(p.title), { ...byTitle.get(slug(p.title)), ideal: p });

    for (const [key, { manual, ideal }] of byTitle) {
      const proc = manual ?? ideal!;
      const idx = bestIndex(proc.title, manualItems);
      const manualText = idx >= 0 ? body(manualItems[idx], proc.title) : '';
      // Their ideal version: the matching numbered Q7 item; or, when Q7 describes this same process, its overview.
      const idealText = (idealItems.length > 1 && idx >= 0 && idealItems[idx]) ||
        (manual && ideal && s.idealProcesses.length === 1 ? s.idealOverview : '') ||
        (s.manualProcesses.length + s.idealProcesses.length <= 2 && !idealItems.length ? '' : '') ||
        (s.manualProcesses.length === 1 && s.idealProcesses.length <= 1 ? s.idealOverview : '');
      const allText = [proc.title, ...proc.steps.map((x) => `${x.tool} ${x.description}`), idealText].join(' ');
      const id = `${person.id}-form-${key}`;
      out.set(id, {
        id,
        ownerId: person.id,
        department: person.departments[0],
        title: proc.title,
        summary: firstSentence(idealText || manualText || proc.steps[0]?.description || proc.title),
        integrationNote: [...new Set(proc.steps.map((x) => x.tool).filter((t) => t && t.length <= 60))].join(', ') || 'From the process form',
        integrations: detectIntegrations(allText),
        difficulty: 'Unrated',
        recommendation: 'From the Workflow Process Form. Steps that change Keap or other systems need approval before they are built.',
        requested: true,
        auditStatus: `Submitted ${s.submittedAt} (${s.id})`,
        stage: 'skeleton',
        source: 'form',
        plan: planFor(manual ?? proc),
        ideal: idealText || undefined,
        manualTime: (manualText.match(TIME) ?? proc.steps.map((x) => x.description).join(' ').match(TIME))?.[0],
        submissionId: s.id,
      });
    }
  }
  return [...out.values()];
}
