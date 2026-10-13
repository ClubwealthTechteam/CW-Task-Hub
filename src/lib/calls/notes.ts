// Call notes for Client Care (Jowelyn's onboarding scheduling, wellness and BSM calls): pick the outcome, get
// the exact note to paste into Keap. Shared by the page and the API (no server-only code here).

export type CallType = 'onboarding' | 'wellness' | 'bsm';
export interface Outcome { id: string; label: string; text: string; needs?: string }
export interface CallEntry { at: number; type: CallType; outcome: string; details?: string; by: string }
export interface CallClient { key: string; name: string; entries: CallEntry[] }

export const CALL_TYPES: { id: CallType; label: string }[] = [
  { id: 'onboarding', label: 'Onboarding scheduling' },
  { id: 'wellness', label: 'Wellness call' },
  { id: 'bsm', label: 'BSM call' },
];

const NO_ANSWER: Outcome[] = [
  { id: 'vm', label: 'No answer · voicemail + text', text: 'No answer. Left voicemail and sent text.' },
  { id: 'novm', label: 'No answer · text only', text: 'No answer. Voicemail not available, sent text.' },
  { id: 'callback', label: 'Asked to call back', text: 'Spoke with client. Asked to call back {x}.', needs: 'When? e.g. tomorrow after 3pm EST' },
  { id: 'wrong', label: 'Wrong / bad number', text: 'Number not working or wrong number. Needs updated phone.' },
];

export const OUTCOMES: Record<CallType, Outcome[]> = {
  onboarding: [
    { id: 'scheduled', label: 'Onboarding scheduled', text: 'Spoke with client. Onboarding scheduled for {x}.', needs: 'Day, date, time + time zone' },
    { id: 'availability', label: 'Will send availability', text: 'Spoke with client. Will send their availability for onboarding.' },
    ...NO_ANSWER,
  ],
  wellness: [
    { id: 'good', label: 'All good', text: 'Spoke with client. Doing well, no concerns.' },
    { id: 'concern', label: 'Concern raised', text: 'Spoke with client. Concern: {x}. Follow-up needed.', needs: 'What’s the concern?' },
    ...NO_ANSWER,
  ],
  bsm: [
    { id: 'confirmed', label: 'Confirmed attendance', text: 'Spoke with client. Confirmed BSM attendance.' },
    { id: 'badge', label: 'Badge details collected', text: 'Spoke with client. Badge details: {x}.', needs: 'Name / company for the badge' },
    { id: 'info', label: 'Sent event info', text: 'Spoke with client. Sent BSM event information.' },
    { id: 'notgoing', label: 'Not attending', text: 'Spoke with client. Not attending BSM.' },
    ...NO_ANSWER,
  ],
};

export const clientKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').trim();
export const outcomeOf = (type: CallType, id: string) => OUTCOMES[type].find((o) => o.id === id);

const day = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
const typeLabel = (t: CallType) => CALL_TYPES.find((c) => c.id === t)?.label ?? t;

/** One dated line, e.g. "Oct 13 · Wellness call: No answer. Left voicemail and sent text." */
export function noteLine(e: CallEntry) {
  const o = outcomeOf(e.type, e.outcome);
  const text = o ? o.text.replace('{x}', e.details?.trim() || '…') : e.details ?? '';
  const extra = o && !o.needs && e.details?.trim() ? ` ${e.details.trim().replace(/\.?$/, '.')}` : '';
  return `${day(e.at)} · ${typeLabel(e.type)}: ${text}${extra}`;
}

/** The whole note for one client, oldest call first, ready to paste over the Keap task's note. */
export const fullNote = (c: CallClient) => c.entries.map(noteLine).join('\n');
