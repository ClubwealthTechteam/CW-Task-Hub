// Task Recording: what the CW Task Recorder extension captured (one step per click, tab switch, typed field,
// copy or paste, each with a screenshot), and Claude's write-up of it (detailed steps, summary, Flow Canvas map).
// A recording is kept under trec:rec:<id>; each screenshot under its own key (trec:shot:<id>:<n>), and every
// person has an index of their recordings (trec:by:<uid>) plus one for everyone's (trec:all), newest first.

import { deleteKey, getJSON, setJSON } from '@/lib/store';
import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';

export const MAX_STEPS = 150;
/** A screenshot's data URL cap. The extension saves them ~1000px wide as WebP, well under this. */
export const SHOT_MAX = 450_000;
const SHOT_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const KEEP = 300;

export type StepKind = 'start' | 'click' | 'tab' | 'page' | 'type' | 'copy' | 'paste' | 'cut';

/** One raw step, as the extension recorded it. Text fields are short and never hold passwords or card numbers. */
export interface RawStep {
  n: number;
  at: number;
  kind: StepKind;
  url: string;
  title: string;
  /** What was clicked or typed into: "Button “Save”", "Cell A2", "Email field". */
  target?: string;
  /** What was typed (only for kind "type"; "[hidden]" for private fields). */
  text?: string;
  /** Google Sheets: the spreadsheet's name, the tab, and the cell or range selected (Name Box). */
  sheet?: string;
  tab?: string;
  range?: string;
  hasShot: boolean;
}

/** One step of Claude's write-up. `from` lists the raw steps it covers; `shot` is the raw step whose screenshot shows it. */
export interface WrittenStep {
  app: string;
  title: string;
  action: string;
  sheet: string;
  tab: string;
  range: string;
  link: string;
  channel: string;
  note: string;
  from: number[];
  shot: number;
}

export interface WriteUp { title: string; steps: WrittenStep[]; summary: string[]; by: 'claude' | 'basic'; at: number }

export interface Recording {
  id: string;
  owner: string;
  at: number;
  title: string;
  /** What the recorder said the task is, if they wrote it. */
  about: string;
  steps: RawStep[];
  status: 'uploading' | 'writing' | 'ready' | 'error';
  error?: string;
  writeUp?: WriteUp;
}

export interface RecordingSummary { id: string; owner: string; at: number; title: string; steps: number; status: Recording['status'] }

const recKey = (id: string) => `trec:rec:${id}`;
const shotKey = (id: string, n: number) => `trec:shot:${id}:${n}`;
const byKey = (uid: string) => `trec:by:${uid}`;
const ALL = 'trec:all';

export const newRecordingId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const validId = (id: string) => /^r[a-z0-9]{6,20}$/.test(id);

/** The recorder sees their own recordings; super admins (Miguel) see everyone's. */
export const canView = (user: Person, rec: Pick<Recording, 'owner'>) => rec.owner === user.id || isSuperAdmin(user);

export async function getRecording(id: string): Promise<Recording | null> {
  return validId(id) ? getJSON<Recording | null>(recKey(id), null) : null;
}

const summaryOf = (r: Recording): RecordingSummary => ({ id: r.id, owner: r.owner, at: r.at, title: r.title, steps: r.steps.length, status: r.status });

export async function saveRecording(rec: Recording) {
  await setJSON(recKey(rec.id), rec);
  for (const key of [byKey(rec.owner), ALL]) {
    const list = await getJSON<RecordingSummary[]>(key, []);
    const next = [summaryOf(rec), ...list.filter((x) => x.id !== rec.id)];
    await setJSON(key, next.slice(0, KEEP));
  }
}

export async function listRecordings(user: Person): Promise<RecordingSummary[]> {
  return getJSON<RecordingSummary[]>(isSuperAdmin(user) ? ALL : byKey(user.id), []);
}

export async function deleteRecording(rec: Recording) {
  await Promise.all(rec.steps.filter((s) => s.hasShot).map((s) => deleteKey(shotKey(rec.id, s.n))));
  await deleteKey(recKey(rec.id));
  for (const key of [byKey(rec.owner), ALL]) {
    const list = await getJSON<RecordingSummary[]>(key, []);
    await setJSON(key, list.filter((x) => x.id !== rec.id));
  }
}

/** Saves one screenshot ("data:image/webp;base64,…"). Returns an error message, or null when saved. */
export async function setShot(id: string, n: number, dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !SHOT_TYPES.includes(m[1])) return 'Send a WebP, JPG or PNG screenshot';
  if (dataUrl.length > SHOT_MAX) return 'That screenshot is too big';
  await setJSON(shotKey(id, n), dataUrl);
  return null;
}

export async function getShot(id: string, n: number): Promise<string | null> {
  return getJSON<string | null>(shotKey(id, n), null);
}

/** Cleans a raw step from the extension: known kinds only, short strings, no stray fields. */
export function cleanStep(x: unknown, n: number): RawStep | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const kinds: StepKind[] = ['start', 'click', 'tab', 'page', 'type', 'copy', 'paste', 'cut'];
  const kind = kinds.find((k) => k === o.kind);
  if (!kind) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const url = str(o.url, 2000) ?? '';
  return {
    n,
    at: typeof o.at === 'number' ? o.at : Date.now(),
    kind,
    url: /^https?:\/\//.test(url) ? url : '',
    title: str(o.title, 200) ?? '',
    target: str(o.target, 200),
    text: str(o.text, 300),
    sheet: str(o.sheet, 200),
    tab: str(o.tab, 100),
    range: str(o.range, 60),
    hasShot: o.hasShot === true,
  };
}
