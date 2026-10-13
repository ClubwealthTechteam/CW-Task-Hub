// Workflow Process Form submissions, read live from the "AI Task Hub - Form Responses" sheet
// (FORM_RESPONSES_SHEET_ID / FORM_RESPONSES_GID; the sheet must be viewable by link). Read-only: the hub
// never writes to the sheet. Cached for a few minutes so pages stay fast.

import { PEOPLE, type Person } from '@/config/people';
import { getJSON, setJSON } from '@/lib/store';

const SHEET_ID = () => process.env.FORM_RESPONSES_SHEET_ID || '1St2MXhY7lugGYl4MdOXyJaTHkW9r1gohXx5uSkNSf4Y';
const GID = () => process.env.FORM_RESPONSES_GID || '106173124';
const CACHE_KEY = 'forms:submissions:v1';
const FRESH_MS = 5 * 60 * 1000;

export interface FormStep { tool: string; description: string; outcomes: { label: string; result: string }[] }
export interface FormProcess { title: string; steps: FormStep[] }
export interface Submission {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  department: string;
  personId: string | null;
  tools: { web: string[]; apps: string[]; spreadsheets: string[] };
  manualOverview: string;     // Q2 in their words
  manualProcesses: FormProcess[];
  idealOverview: string;      // Q7 in their words
  idealProcesses: FormProcess[];
  info: string;               // Q3
  repetitive: string;         // Q4
  judgment: string;           // Q5
  bottlenecks: string;        // Q6
  platform: string;
  editOf?: string;
}

/** RFC 4180 CSV (quoted fields with commas, quotes and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Matches a form name ("Jizel Cañada", "Ali Berico") to a hub person. */
export function matchPerson(name: string): Person | undefined {
  const n = norm(name);
  const squashed = n.replace(/[^a-z]/g, '');
  const first = n.split(/[\s\-()]+/)[0];
  // Also matches a name in brackets, e.g. "Jowee (Jowelyn)" for "Jowelyn Masangya".
  return PEOPLE.find((p) => squashed.startsWith(p.id) || norm(p.name).split(/[\s\-()]+/)[0] === first)
    ?? PEOPLE.find((p) => (norm(p.name).match(/\(([^)]+)\)/)?.[1] ?? '').split(/\s+/).includes(first));
}

const isTest = (name: string, email: string) => /^test\b/i.test(name.trim()) || /^test[.@]/i.test(email.trim());

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function processes(q: Raw | undefined): FormProcess[] {
  return (Array.isArray(q?.tasks) ? q!.tasks : [])
    .map((t: Raw) => ({
      title: String(t.title ?? '').trim(),
      steps: (Array.isArray(t.steps) ? t.steps : []).map((s: Raw) => ({
        tool: String(s.tool ?? '').trim(),
        description: String(s.description ?? '').trim(),
        outcomes: (Array.isArray(s.outcomes) ? s.outcomes : []).map((o: Raw) => ({ label: String(o.label ?? ''), result: String(o.result ?? '') })),
      })).filter((s: FormStep) => s.tool || s.description),
    }))
    .filter((p: FormProcess) => p.steps.length);
}

const text = (q: unknown) => (typeof q === 'string' ? q : typeof (q as Raw)?.overview === 'string' ? (q as Raw).overview : '').trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((x) => x.trim() && !/^n\/?a$/i.test(x.trim())) : []);

function toSubmission(header: string[], row: string[]): Submission | null {
  const col = (name: string) => row[header.indexOf(name)] ?? '';
  let raw: Raw = {};
  try { raw = JSON.parse(col('Raw JSON') || '{}'); } catch { /* fall back to the columns */ }
  const name = String(raw.name ?? col('Name')).trim();
  const email = String(raw.email ?? col('Email')).trim();
  if (!name || isTest(name, email)) return null;
  return {
    id: col('Submission ID'),
    submittedAt: col('Submitted At'),
    name,
    email,
    department: String(raw.department ?? col('Department')),
    personId: matchPerson(name)?.id ?? null,
    tools: { web: list(raw.tools?.web), apps: list(raw.tools?.apps), spreadsheets: list(raw.tools?.spreadsheets) },
    manualOverview: text(raw.q2) || col('Q2 Process (Manual Way)'),
    manualProcesses: processes(raw.q2),
    idealOverview: text(raw.q7) || col('Q7 Ideal Automated Version'),
    idealProcesses: processes(raw.q7),
    info: text(raw.q3) || col('Q3 Information Needed'),
    repetitive: text(raw.q4) || col('Q4 Manual / Repetitive Steps'),
    judgment: text(raw.q5) || col('Q5 Judgment / Approval'),
    bottlenecks: text(raw.q6) || col('Q6 Bottlenecks & Workarounds'),
    platform: text(raw.platform) || col('Preferred Platform'),
    editOf: raw.editOf ? String(raw.editOf) : undefined,
  };
}

/** Drops resubmissions: an edited submission replaces the one it edits, and identical repeats keep the latest. */
function dedupe(subs: Submission[]) {
  const replaced = new Set(subs.map((s) => s.editOf).filter(Boolean));
  const seen = new Map<string, Submission>();
  for (const s of subs) {
    if (replaced.has(s.id)) continue;
    const key = `${s.personId ?? s.name}|${s.manualOverview}|${s.idealOverview}`;
    seen.set(key, s); // rows are oldest first, so the latest wins
  }
  return [...seen.values()];
}

async function download(): Promise<Submission[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/export?format=csv&gid=${GID()}`;
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000) });
  const body = await res.text();
  if (!res.ok || body.trimStart().startsWith('<')) throw new Error(`Form responses sheet couldn’t be read (${res.status}). Is it viewable by link?`);
  return parseSubmissions(body);
}

/** Parses the sheet's CSV export into submissions (tests and duplicates removed). */
export function parseSubmissions(csv: string): Submission[] {
  const [header, ...rows] = parseCsv(csv);
  return dedupe(rows.map((r) => toSubmission(header, r)).filter((s): s is Submission => Boolean(s)));
}

let memo: { at: number; subs: Submission[] } | null = null;

/** All real submissions (tests and duplicates removed). Never throws: falls back to the last good copy. */
export async function getSubmissions(): Promise<Submission[]> {
  if (memo && Date.now() - memo.at < FRESH_MS) return memo.subs;
  const cached = await getJSON<{ at: number; subs: Submission[] } | null>(CACHE_KEY, null).catch(() => null);
  if (cached && Date.now() - cached.at < FRESH_MS) { memo = cached; return cached.subs; }
  try {
    const subs = await download();
    memo = { at: Date.now(), subs };
    await setJSON(CACHE_KEY, memo).catch(() => undefined);
    return subs;
  } catch (e) {
    console.error('forms:', (e as Error).message);
    const fallback = cached ?? memo;
    return fallback?.subs ?? [];
  }
}

export const submissionsOf = async (personId: string) => (await getSubmissions()).filter((s) => s.personId === personId);
