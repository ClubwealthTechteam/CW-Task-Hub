// The SOP Handbook: one numbered article per recurring admin task (Miguel's Admin SOP Handbook proposal, Oct 2026).
// Each article names a Main Admin who owns the task and a POC Admin who covers it when the Main is out, and the
// steps are written so the POC can follow them on the day with no training. When a step turns out unclear or
// wrong, fix it here the same day and bump `updated`.

import type { ReactNode } from 'react';
import type { DepartmentId } from '@/config/departments';

export interface SopTool { name: string; url?: string; note?: string }

/** One way out of a decision step: what it looks like, what to do, and which step to go to next. */
export interface SopPath {
  /** The answer, short: "Yes", "Not found in Keap", "PHONE_EXACT / NAME_EXACT". */
  label: string;
  /** 'yes' paths show green, 'no' paths red, like the YES / NO dots on the Flow Canvas. */
  tone: 'yes' | 'no';
  /** What you'll see on this path, e.g. "Column K shows MATCHED_REGISTRANT". */
  means?: ReactNode;
  /** The short checklist for this path (can be empty: nothing to do). */
  todo: ReactNode[];
  /** The step to continue with. */
  next: { step: number; label: string };
}

/** A step where the work splits two ways (a YES / NO node on the flow). */
export interface SopDecision {
  kind: 'decision';
  /** The question, e.g. "Did this person match a registration?" */
  ask: ReactNode;
  /** Short name for the Contents panel, e.g. "Matched?" */
  short: string;
  /** Where to look to answer it. */
  check?: ReactNode;
  where?: SopWhere[];
  /** Shown above the paths, e.g. "Do this for each person still blank." */
  note?: ReactNode;
  paths: [SopPath, SopPath];
}

/** Where a step happens: the exact sheet + tab + cells (with a link that opens right there), or the app screen. */
export interface SopWhere {
  app: 'sheet' | 'slack' | 'keap' | 'eventbrite' | 'hub';
  /** Sheet title or app place, e.g. "LIST MAKING CHECKLIST (Half-Day Events)", "#cw-half-day-registration-forms-automation". */
  name: string;
  url?: string;
  tab?: string;
  /** The cells or columns to look at / work in, e.g. "S2 (Call Claude)", "Columns C:K". */
  cells?: string;
  /** What you do there, in a few words. */
  action?: string;
}

/** A plain step with its "Where" details. */
export interface SopPlain {
  kind: 'step';
  body: ReactNode;
  where?: SopWhere[];
  /** A Note node attached to this step on the flow. */
  note?: ReactNode;
  /** Which decision path this step is on, e.g. "Step 8 · If NO_REGISTRATION_MATCH". */
  branch?: string;
  /** Where to jump when this is the last step of a path (paths meet again at a later step). */
  next?: { step: number; label: string };
}

export type SopStep = ReactNode | SopPlain | SopDecision;

export const isPlain = (s: SopStep): s is SopPlain =>
  typeof s === 'object' && s !== null && !Array.isArray(s) && (s as SopPlain).kind === 'step';
export const stepWhere = (s: SopStep): SopWhere[] => (isPlain(s) || isDecision(s) ? s.where ?? [] : []);

export const isDecision = (s: SopStep): s is SopDecision =>
  typeof s === 'object' && s !== null && !Array.isArray(s) && (s as SopDecision).kind === 'decision';

/** One entry in an article's version history. */
export interface SopVersion { v: number; date: string; by: string; what: string }

/** The sections added for the 7-part SOP structure; each stays marked as a draft until Miguel approves it. */
export type SopDraftSection = 'scope' | 'purpose' | 'responsibilities' | 'safety';

/** How often an article is reviewed unless it says otherwise. */
export const REVIEW_EVERY_DAYS = 90;

export interface SopArticle {
  /** Department prefix + number, e.g. EV-01. Never reuse a number once it's been given out (EV-02, the manual
   *  stats backup, was retired on 2026-10-26: Andrea now covers EV-01 as its POC). */
  id: string;
  title: string;
  department: DepartmentId;
  /** Person ids from src/config/people.ts. A POC of null means one still has to be named. */
  main: string;
  poc: string | null;
  /** Effective Period: how often the task runs. */
  when: string;
  sheets: { name: string; url?: string }[];
  /** The other systems the task uses (Slack channels, Keap, Eventbrite…). With `sheets` they make "Tools to Use". */
  tools: SopTool[];
  /** Every version, oldest first. Add one whenever the steps change; the last one is the current version. */
  versions: SopVersion[];
  /** When this version took effect, and when someone last checked the steps still match the work ("Oct 26, 2026"). */
  effective: string;
  lastReviewed: string;
  /** Review the article this often (days) after lastReviewed. Defaults to REVIEW_EVERY_DAYS. */
  reviewEveryDays?: number;
  /** 1. Scope: where and when the SOP applies (with `when` and `exemptions`). */
  scope: ReactNode;
  /** 2. Purpose: why the task exists and what it protects. */
  purpose: ReactNode;
  /** 3. Responsibilities: who does what, including the bots. */
  responsibilities: { who: string; does: ReactNode }[];
  /** 6. Safety guidelines: the risks in the task and the control for each. "If it breaks" sits with them. */
  safety: { risk: ReactNode; control: ReactNode }[];
  /** Sections written up from the guide (Oct 26, 2026) that Miguel has checked. The rest show "Draft · check with Miguel". */
  approved?: SopDraftSection[];
  /** Who or what this SOP doesn't apply to. Omitted = none. */
  exemptions?: ReactNode;
  /** What to have or read before starting. */
  prerequisites: ReactNode[];
  /** Anything else worth knowing that isn't a step. */
  additionalInfo?: ReactNode[];
  /** Terms used in the steps, explained for a POC who has never done the task. */
  glossary: { term: string; meaning: ReactNode }[];
  /** Has the POC run it once while the Main watched? Only then is the article "ready". */
  testRun: string;
  status: 'draft' | 'ready';
  /** Steps whose details the Main Admin still has to write in. */
  gaps?: string;
  summary: string;
  /** Plain steps and decision steps, in order. Step numbers are positions in this list (1 = first). */
  steps: SopStep[];
  /** Screenshot per step, by step number (1 = first step): a path under public/, e.g. '/sop/EV-01/step-1.png'.
   *  Steps without one show a pasted screenshot if there is one (see src/lib/sop.ts), else a placeholder. */
  shots?: Record<number, string>;
  ifItBreaks: ReactNode[];
}

const LIST_MAKING = { name: 'LIST MAKING CHECKLIST (Half-Day Events)', url: 'https://docs.google.com/spreadsheets/d/1mwt8MoYtxJIc5mdcDxCa0S8icLTEDWOI7Xl3z74YfPM/edit' };
const DHR = { name: 'DHR → tab Event_Registrants', url: 'https://docs.google.com/spreadsheets/d/1drBAkBOxquL5i817IBF2tmnNqLexyvGHPOsu9h201kk/edit' };
const CWSOCIAL_AUDIT = { name: 'CWSocial25 Audit → tab Tracking Report', url: 'https://docs.google.com/spreadsheets/d/1V_od_nCch8lkoE_OBPffDl9JCHPnHhtAuAM7gE-AF8s/edit' };
const EVENT_OPT_IN = { name: 'Event Opt In (Zapier - Twilio) → tab Sheet1', url: 'https://docs.google.com/spreadsheets/d/1Dlt9zyQZQ85xk6xSrrwGH7uvsqGFvPYM4KQu3oAJQqM/edit' };
const HALF_DAY_STATS = { name: 'Half-Day Events Stats → tab LABC2026', url: 'https://docs.google.com/spreadsheets/d/1mBkjMGnbGUY0rmPhpNYBaVnRRuvTdyiqI9oD4dMVHDc/edit' };
const HALF_DAY_FORMS = { name: 'Club Wealth Event Half Day Forms → tab HALF DAY FORMS 2026 v2', url: 'https://docs.google.com/spreadsheets/d/1mh-xjBC7vs_HWEbhySukD2cxIm3yoBKbmJvteHOpY-A/edit' };

// Deep links that open a sheet right on the tab (gid) and cells; tab ids read from the sheets (Oct 26, 2026).
const sheetLink = (id: string, gid: number, range?: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}${range ? `&range=${encodeURIComponent(range)}` : ''}`;
const LM_ID = '1mwt8MoYtxJIc5mdcDxCa0S8icLTEDWOI7Xl3z74YfPM';
const DHR_ID = '1drBAkBOxquL5i817IBF2tmnNqLexyvGHPOsu9h201kk';
const AUDIT_ID = '1V_od_nCch8lkoE_OBPffDl9JCHPnHhtAuAM7gE-AF8s';
const OPTIN_ID = '1Dlt9zyQZQ85xk6xSrrwGH7uvsqGFvPYM4KQu3oAJQqM';
const STATS_ID = '1mBkjMGnbGUY0rmPhpNYBaVnRRuvTdyiqI9oD4dMVHDc';
const TABS = {
  attendance: { id: LM_ID, sheet: 'LIST MAKING CHECKLIST (Half-Day Events)', tab: 'Attendance Extracted', gid: 1824377100 },
  registration: { id: LM_ID, sheet: 'LIST MAKING CHECKLIST (Half-Day Events)', tab: 'Event Registration', gid: 735260619 },
  dhr: { id: DHR_ID, sheet: 'DHR', tab: 'Event_Registrants', gid: 1552325485 },
  audit: { id: AUDIT_ID, sheet: 'CWSocial25 Audit', tab: 'Tracking Report', gid: 2016314971 },
  optin: { id: OPTIN_ID, sheet: 'Event Opt In (Zapier - Twilio)', tab: 'Sheet1', gid: 0 },
  forms: { id: '1mh-xjBC7vs_HWEbhySukD2cxIm3yoBKbmJvteHOpY-A', sheet: 'Club Wealth Event Half day Forms', tab: 'HALF DAY FORMS 2026 v2', gid: 1851780240 },
  stats: { id: STATS_ID, sheet: 'Half-Day Events Stats', tab: 'LABC2026', gid: 1697294296 },
} as const;
/** A sheet "Where" row: `range` (A1 notation) is where the link lands; `cells` is what the reader is told. */
const at = (t: keyof typeof TABS, cells?: string, action?: string, range?: string): SopWhere => {
  const x = TABS[t];
  return { app: 'sheet', name: x.sheet, tab: x.tab, url: sheetLink(x.id, x.gid, range), cells, action };
};
const step = (body: ReactNode, where?: SopWhere[], extra?: Pick<SopPlain, 'note' | 'branch' | 'next'>): SopPlain => ({ kind: 'step', body, where, ...extra });
const ATT_SLACK: SopWhere = { app: 'slack', name: '#cw-half-day-registration-forms-automation', cells: 'Tara’s post with the PDF, and its thread' };
const FORMS_SLACK: SopWhere = { app: 'slack', name: '#cw-halfday-event-forms-automation', cells: 'Tara’s forms posts and the bot’s replies' };
const KEAP_CONTACTS: SopWhere = { app: 'keap', name: 'Keap → Contacts', url: 'https://app.infusionsoft.com', cells: 'Search by name or phone' };

const KEAP: SopTool = { name: 'Keap', url: 'https://app.infusionsoft.com', note: 'Contacts and tags' };
const EVENTBRITE: SopTool = { name: 'Eventbrite', url: 'https://www.eventbrite.com/organizations/home', note: 'Tickets and check-ins' };
const FORMS_CHANNEL: SopTool = { name: 'Slack #cw-halfday-event-forms-automation', note: 'Tara’s order-form PDFs and the bot’s replies' };

export const SOP_ARTICLES: SopArticle[] = [
  {
    id: 'EV-01',
    title: 'Half-Day Event attendance tagging',
    department: 'events',
    main: 'ali',
    poc: 'andrea',
    when: 'After each half-day event, once the bot replies “Attendance extracted”',
    sheets: [LIST_MAKING, DHR, CWSOCIAL_AUDIT, EVENT_OPT_IN, HALF_DAY_STATS],
    versions: [
      { v: 1, date: 'Oct 23, 2026', by: 'Miguel', what: 'First version.' },
      { v: 2, date: 'Oct 26, 2026', by: 'Miguel', what: 'Rewritten from Miguel’s flow map. Andrea named POC; the manual stats backup (EV-02) retired.' },
      { v: 3, date: 'Oct 26, 2026', by: 'Miguel', what: 'Follows the flow map node for node (39 steps).' },
      { v: 4, date: 'Oct 26, 2026', by: 'Miguel', what: 'Laid out in the 7-part SOP structure (Scope, Purpose, Responsibilities, Materials and Tools, Execution Sequence, Safety Guidelines, Review and Update). Scope, Purpose, Responsibilities and Safety are drafts for Miguel to check.' },
    ],
    scope: <>Every Club Wealth half-day event whose sign-in sheet Tara posts in Slack <b>#cw-half-day-registration-forms-automation</b>. It starts when the bot replies “Attendance extracted” and ends when the event is archived in LIST MAKING CHECKLIST. One event at a time: finish and archive one before starting the next. It doesn’t cover the order forms (AD-01), billing (CC-01) or the Homexa emails (AD-02).</>,
    purpose: <>Get an accurate list of who attended each half-day event, so the Stat Sheet, Keap’s not-attended tags, the CWSocial25 audit, the opt-ins and Half-Day Event Stats all show the same numbers. The Homexa and Not Attended emails (AD-02) wait on this task.</>,
    responsibilities: [
      { who: 'Tara', does: <>Posts the scanned sign-in PDF link in Slack (step 1).</> },
      { who: 'Claude (the bot)', does: <>Fills columns A–E and tags Ali and Andrea (step 2). After Call Claude is ticked, writes the stats and posts the Stat Sheet (steps 25–26).</> },
      { who: 'Ali (Main Admin)', does: <>Steps 3–39: matching, filling in missing contacts, Finalize Attendance, Call Claude, Eventbrite, Keap, the CWSocial25 audit, opt-ins, event stats, archive.</> },
      { who: 'Andrea (POC Admin)', does: <>The same steps when Ali is out. There’s no separate backup process.</> },
      { who: 'Miguel (Tech)', does: <>Fixes the sheet’s Custom Tools and the bot, and updates this SOP the same day a step is wrong.</> },
    ],
    safety: [
      { risk: <>Nothing matches after Match Attendance.</>, control: <>Load this event’s registrations from DHR (steps 4–5, date in A2) before clicking Match Attendance.</> },
      { risk: <>Duplicate contacts in Keap.</>, control: <>Search Keap by name first (step 16). Create a new contact only when the search finds nobody (step 20).</> },
      { risk: <>Stats posted from unfinished data.</>, control: <>Tick Call Claude (S2) only after Finalize Attendance, and only once. Ticking it again within 10 minutes does nothing.</> },
      { risk: <>Losing the event’s rows before they’re used.</>, control: <>Archive (step 39) last, after the Stat Sheet is posted and Half-Day Event Stats is updated.</> },
      { risk: <>Personal details shared in the open.</>, control: <>Never paste registrants’ phones or emails in Slack. They stay in the sheets and Keap.</> },
      { risk: <>Breaking the sheet’s tools.</>, control: <>Run Custom Tools only from the sheet’s menu, never from the Apps Script editor.</> },
    ],
    testRun: 'Not yet · Andrea with Ali',
    status: 'draft',
    effective: 'Oct 26, 2026',
    lastReviewed: 'Oct 26, 2026',
    tools: [
      { name: 'Slack #cw-half-day-registration-forms-automation', note: 'Tara’s sign-in PDF, the bot’s “Attendance extracted” and Stat Sheet replies' },
      KEAP,
      EVENTBRITE,
    ],
    prerequisites: [
      <>The bot has replied <b>“Attendance extracted — [City] - [Date]”</b> in Tara’s Slack thread.</>,
      <>Edit access to LIST MAKING CHECKLIST, DHR, CWSocial25 Audit, Event Opt In and Half Day Event Stats (the sheets under Tools to Use).</>,
      <>A Keap login that can search, create contacts and apply tags, and an Eventbrite login for the event’s check-ins.</>,
    ],
    additionalInfo: [
      <><b>Clear Archive Attendance</b> (last step) is under maintenance right now.</>,
    ],
    glossary: [
      { term: 'Attendance Extracted', meaning: 'The LIST MAKING CHECKLIST tab where the bot writes who signed in (columns A–E) and Match Attendance fills the rest.' },
      { term: 'Event Registration', meaning: 'The LIST MAKING CHECKLIST tab holding the event’s registrations, pasted in from DHR. Match Attendance compares against it.' },
      { term: 'DHR', meaning: 'The sheet with every event’s registrants (tab Event_Registrants). Pick the event date in A2 to show that event.' },
      { term: 'Match Method (column J)', meaning: <><b>PHONE_EXACT</b> or <b>NAME_EXACT</b>: found in the registrations. <b>NO_REGISTRATION_MATCH</b>: not found, so columns F:I stay blank for you to fill.</> },
      { term: 'MATCHED_REGISTRANT', meaning: 'Match Status (column K) for a person who matched. Nothing more to do for them.' },
      { term: 'Contact ID', meaning: 'A person’s number in Keap. It’s in the browser’s address bar on their Keap contact page.' },
      { term: 'Call Claude (S2)', meaning: 'The checkbox that tells the bot to work out the stats and post the Stat Sheet in Slack.' },
      { term: 'CWSocial25', meaning: 'A promo code from the social campaign. Those registrants are also logged in the CWSocial25 Audit sheet.' },
      { term: 'Not-Attended tag', meaning: 'The Keap tag for people who registered but didn’t come, e.g. “Non-Attended - Plano TX - 10-22-2026”.' },
    ],
    summary: 'Miguel’s flow, node by node: Claude reads the sign-in PDF into the sheet, you match it to the registrations and fill in anyone missing, Claude posts the stats, then you update Eventbrite, Keap, the CWSocial25 audit, the opt-ins and the event stats.',
    // One step per node of Miguel's Flow Canvas map "Half Day Events Registration Main" (Oct 26, 2026), in flow order.
    // Keep it node for node: don't merge or shorten steps.
    steps: [
      // 1 · Slack
      step(<>Tara sends the PDF scanned file link in Slack.</>, [
        { ...ATT_SLACK, cells: 'Tara’s post with the PDF scanned file link', action: 'Find the post for this event' },
      ]),
      // 2 · Claude AI
      step(<>Claude fills out columns <b>A–E</b> and notifies Ali and Andrea (it replies <b>“Attendance extracted — [City] - [Date]”</b> in Tara’s thread).</>, [
        at('attendance', 'Columns A–E (Extracted Name, Phone, Source Page, Source Type, Notes)', 'Claude fills these in', 'A1:E1'),
        { ...ATT_SLACK, cells: 'Tara’s thread', action: 'Claude’s “Attendance extracted” reply tags Ali and Andrea' },
      ]),
      // 3 · Google Sheets (Attendance Extracted)
      step(<>Open <b>LIST MAKING CHECKLIST → Attendance Extracted</b>.</>, [
        at('attendance', 'Columns A–E (filled by Claude)', 'Open the tab', 'A1:E1'),
      ]),
      // 4 · Google Sheets (DHR)
      step(<>Open <b>DHR → Event_Registrants</b>. Select the corresponding date that Tara’s PDF is for in <b>cell A2</b>. Then copy columns <b>C:K</b> and paste them in the next step.</>, [
        at('dhr', 'Cell A2', 'Select the event date', 'A2'),
        at('dhr', 'Columns C:K', 'Copy', 'C:K'),
      ], { note: 'For automation opportunity.' }),
      // 5 · Google Sheets (Event Registration)
      step(<>Paste to the <b>Event Registration</b> tab.</>, [
        at('registration', 'The tab (where the previous event’s rows are)', 'Paste what you copied from DHR'),
      ]),
      // 6 · Google Sheets (Match Attendance)
      step(<>Go back to <b>Attendance Extracted</b>. In the header menu, find and click <b>Custom Tools → “Match Attendance”</b>.</>, [
        at('attendance', 'Header menu: Custom Tools → Match Attendance', 'Click it once'),
      ]),
      // 7 · Google Sheets (F:Q fill in)
      step(<>A pop-up prompt shows after clicking “Match Attendance”. Columns <b>F:Q</b> populate with the data based on the <b>Event Registration</b> tab.</>, [
        at('attendance', 'Columns F:Q', 'These fill in', 'F1:Q1'),
      ], { note: 'If the Event Registration tab (same sheet) is not filled with the selected date from DHR → Event_Registrants, nothing will match, and the Attendance Extracted columns are left unmatched.' }),
      // 8 · Decision: Matched?
      {
        kind: 'decision',
        short: 'Matched?',
        ask: <>Matched?</>,
        check: <>Check column <b>J = Match Method</b>. It shows one of two options: <b>PHONE_EXACT / NAME_EXACT</b>, or <b>NO_REGISTRATION_MATCH</b>.</>,
        where: [at('attendance', 'Column J (Match Method)', 'Check it for each row', 'J:J')],
        paths: [
          { label: 'PHONE_EXACT / NAME_EXACT', tone: 'yes', todo: [], next: { step: 9, label: 'Column K shows MATCHED_REGISTRANT' } },
          { label: 'NO_REGISTRATION_MATCH', tone: 'no', todo: [], next: { step: 11, label: 'Blank cells in columns F:I' } },
        ],
      },
      // 9 · Google Sheets (Match Status)
      step(<>Column <b>K – “Match Status”</b> shows <b>“MATCHED_REGISTRANT”</b> in its dropdown.</>, [
        at('attendance', 'Column K (Match Status)', 'Shows MATCHED_REGISTRANT', 'K:K'),
      ], { branch: 'Step 8 · If PHONE_EXACT / NAME_EXACT' }),
      // 10 · Person is Matched
      step(<><b>Person is matched.</b> No need to review. This is complete.</>, undefined, { branch: 'Step 8 · If PHONE_EXACT / NAME_EXACT', next: { step: 22, label: 'Finalize Attendance' } }),
      // 11 · Google Sheets (blank F:I)
      step(<>Blank cells show in columns <b>F:I</b>. Select and take note of the persons with blank cells under columns F:I.</>, [
        at('attendance', 'Columns F:I + the blank rows', 'Take note of each person', 'F:I'),
      ], { branch: 'Step 8 · If NO_REGISTRATION_MATCH' }),
      // 12 · Google Sheets (find name)
      step(<>Find the person’s first and last name in columns <b>A:B</b> of the <b>Event Registration</b> tab.</>, [
        at('registration', 'Columns A:B (First, Last Name)', 'Search the name (Ctrl/⌘+F)', 'A:B'),
      ]),
      // 13 · Decision: Name present in sheet tab?
      {
        kind: 'decision',
        short: 'Name present?',
        ask: <>Name present in the sheet tab?</>,
        where: [at('registration', 'Columns A:B (First, Last Name)', 'Is the name there?', 'A:B')],
        paths: [
          { label: 'Yes', tone: 'yes', todo: [], next: { step: 14, label: 'Copy Email, Phone Number, Contact ID' } },
          { label: 'No', tone: 'no', todo: [], next: { step: 16, label: 'Find the contact in Keap' } },
        ],
      },
      // 14 · Google Sheets (copy from Event Registration)
      step(<>Copy the <b>Email</b>, <b>Phone Number</b> and <b>Contact ID</b> cells and paste them in the next step.</>, [
        at('registration', 'The person’s Email, Phone Number and Contact ID cells', 'Copy'),
      ], { branch: 'Step 13 · If Yes' }),
      // 15 · Google Sheets (paste + Approved)
      step(<>Paste to the person’s blank columns <b>F:I</b> and click <b>Yes</b> under column <b>L (“Approved”)</b>.</>, [
        at('attendance', 'Columns F:I + the blank row', 'Paste', 'F:I'),
        at('attendance', 'Column L (Approved)', 'Click Yes', 'L:L'),
      ], { branch: 'Step 13 · If Yes', next: { step: 22, label: 'Finalize Attendance' } }),
      // 16 · Keap (find contact)
      step(<>Find the contact (name) in <b>Keap</b>.</>, [
        { ...KEAP_CONTACTS, cells: 'Search by name' },
      ], { branch: 'Step 13 · If No' }),
      // 17 · Decision: Check Keap
      {
        kind: 'decision',
        short: 'Check Keap',
        ask: <>Check Keap</>,
        where: [KEAP_CONTACTS],
        paths: [
          { label: 'Present in Keap', tone: 'yes', todo: [], next: { step: 18, label: 'Copy Email, Phone Number, Contact ID' } },
          { label: 'Not found in Keap', tone: 'no', todo: [], next: { step: 20, label: 'Create a new contact' } },
        ],
      },
      // 18 · Keap (copy)
      step(<>Copy the <b>Email</b>, <b>Phone Number</b> and <b>Contact ID</b>.</>, [
        { app: 'keap', name: 'Keap → the contact’s page', url: 'https://app.infusionsoft.com', cells: 'Email, Phone Number; Contact ID in the address bar', action: 'Copy' },
      ], { branch: 'Step 17 · If Present in Keap', note: <>The Contact ID can be found in the address bar: the number after <b>“ID=”</b>.<img className="sop-note-img" src="/sop/EV-01/keap-contact-id.webp" alt="Keap contact page address bar: the Contact ID is the number after ID=" width={841} height={47} /></> }),
      // 19 · Google Sheets (paste)
      step(<>Paste and update the blank cells under columns <b>F:I</b> with the Email, Phone Number and Contact ID.</>, [
        at('attendance', 'Columns F:I + the blank row', 'Paste', 'F:I'),
      ], { branch: 'Step 17 · If Present in Keap', next: { step: 22, label: 'Finalize Attendance' } }),
      // 20 · Keap (create)
      step(<>Create a new contact in <b>Keap</b> and fill out the contact information.</>, [
        { app: 'keap', name: 'Keap → Contacts → Add a contact', url: 'https://app.infusionsoft.com', action: 'Create and fill out' },
      ], { branch: 'Step 17 · If Not found in Keap' }),
      // 21 · Google Sheets (update)
      step(<>Update the blank cells under columns <b>F:I</b> with the Email, Phone Number and Contact ID.</>, [
        at('attendance', 'Columns F:I + the blank row', 'Update', 'F:I'),
      ], { branch: 'Step 17 · If Not found in Keap', next: { step: 22, label: 'Finalize Attendance' } }),
      // 22 · Google Sheets (Finalize Attendance)
      step(<>In the header menu, find and click <b>Custom Tools → “Finalize Attendance”</b>.</>, [
        at('attendance', 'Header menu: Custom Tools → Finalize Attendance', 'Click it once'),
      ], { branch: 'All paths meet here' }),
      // 23 · Google Sheets (finalized)
      step(<>A pop-up prompt shows after clicking “Finalize Attendance”, and the sheet data is finalized.</>, [
        at('attendance', 'The pop-up prompt', 'The data is finalized'),
      ]),
      // 24 · Google Sheets (Call Claude)
      step(<>Under the <b>“Call Claude”</b> column, tick the checkbox to call on Claude to finalize the numbers for <b>Total Attended</b>, <b>CWSocial25</b> and <b>Opt-Ins</b>, and their percentages.</>, [
        at('attendance', 'Cell S2 (Call Claude checkbox)', 'Tick it once', 'S2'),
      ]),
      // 25 · Claude AI
      step(<>Claude finalizes the numbers and fills out the cells for <b>Total Attended</b>, <b>CWSocial25</b> and <b>Opt-Ins</b>, and their percentages, in the sheet.</>, [
        at('attendance', 'T2:V2 numbers, T4:V4 percentages', 'Claude fills these', 'T2:V4'),
      ]),
      // 26 · Slack (Stat Sheet)
      step(<>The Club Wealth Assistant bot in Slack posts the finalized numbers as a report in Tara’s main message thread. Example report:
        <pre className="sop-example">{'Plano TX\nStat Sheet | Updated\n\n28 of 201 Attended Tagged | 13.93%\n1 of 10 CWSocial25 | 10.00%\n11 of 28 Opt-Ins | 39.29%\n@Tara Hellickson'}</pre></>, [
        { ...ATT_SLACK, cells: 'Tara’s main message thread', action: 'The bot posts the report here' },
      ]),
      // 27 · Eventbrite
      step(<>In <b>Eventbrite</b>, check the check-ins for the tickets bought.</>, [
        { app: 'eventbrite', name: 'Eventbrite → Events → this event', url: 'https://www.eventbrite.com/organizations/events', action: 'Check the check-ins' },
      ]),
      // 28 · Keap (not-attended)
      step(<>In <b>Keap</b>, check the not-attended. Filter, and apply the <b>not-attended tag</b> to the ones that didn’t attend.</>, [
        { app: 'keap', name: 'Keap → Contacts', url: 'https://app.infusionsoft.com', cells: 'Filter the not-attended', action: 'Apply the not-attended tag' },
      ]),
      // 29 · Google Sheets (CWSocial25 filter)
      step(<>In <b>Event Registration</b>, filter column <b>E</b> to <b>“CWSocial25”</b>. Take note, and make sure that everyone is present in the next step.</>, [
        at('registration', 'Column E “Promo Code” = CWSocial25', 'Filter and take note', 'E:E'),
      ]),
      // 30 · Keap (double check)
      step(<><b>For double-checking purposes:</b> in <b>Keap</b>, find and filter the event that happened under the recent date.</>, [
        { app: 'keap', name: 'Keap → Contacts', url: 'https://app.infusionsoft.com', cells: 'The event, by its recent date', action: 'Find and filter' },
      ]),
      // 31 · Google Sheets (copy A:F)
      step(<>In <b>Event Registration</b>, copy columns <b>A:F</b> and paste them in the next step.</>, [
        at('registration', 'Columns A:F (CWSocial25 filter on column E “Promo Code”)', 'Copy', 'A:F'),
      ]),
      // 32 · Google Sheets (CWSocial25 Audit)
      step(<>Open <b>CWSocial25 Audit → Tracking Report</b>. Scroll down to the bottom end, where the rows have text. Paste to the blank row under column <b>E</b>. If column <b>K</b> is blank, put <b>“No”</b>. Then update <b>A:D</b>: Month Tag, Date, Location City and Location State.</>, [
        at('audit', 'Column E, the blank row at the bottom', 'Paste', 'E:E'),
        at('audit', 'Column K', 'Put “No” where it’s blank', 'K:K'),
        at('audit', 'Columns A:D (Month Tag, Date, Location City, Location State)', 'Update', 'A:D'),
      ]),
      // 33 · Google Sheets (Event Opt In)
      step(<>Open <b>Event Opt In → Sheet1</b>. Scroll to the very bottom and find whether the email is present or blank.</>, [
        at('optin', 'Column G (email), the bottom rows', 'Check each one', 'G:G'),
      ]),
      // 34 · Decision: Email there?
      {
        kind: 'decision',
        short: 'Email there?',
        ask: <>Email there?</>,
        where: [at('optin', 'Column G (email)', 'Present or blank?', 'G:G')],
        paths: [
          { label: 'Present', tone: 'yes', todo: [], next: { step: 35, label: 'No need for processing' } },
          { label: 'Blank', tone: 'no', todo: [], next: { step: 36, label: 'Search the contact in Keap' } },
        ],
      },
      // 35 · No Need for Processing
      step(<><b>No need for processing.</b></>, undefined, { branch: 'Step 34 · If Present', next: { step: 38, label: 'Update Half-Day Event Stats' } }),
      // 36 · Keap (search email)
      step(<>In <b>Keap</b>, search the contact by name or phone number and find the email.</>, [
        { ...KEAP_CONTACTS, cells: 'Search by name or phone number', action: 'Find the email' },
      ], { branch: 'Step 34 · If Blank' }),
      // 37 · Google Sheets (update email)
      step(<>Update the blank cell with the email.</>, [
        at('optin', 'Column G, the blank cell', 'Type the email', 'G:G'),
      ], { branch: 'Step 34 · If Blank', next: { step: 38, label: 'Update Half-Day Event Stats' } }),
      // 38 · Google Sheets (Half Day Event Stats)
      step(<>Open <b>Half-Day Event Stats → LABC 2026</b> and update the numbers for the event: <b>TX Sold</b> (from Eventbrite), <b>IFS List</b> (from Keap), <b>Total Showup</b> and <b>Eligible</b> (the same numbers), and <b>Opt-ins</b> (from total opt-ins attended).</>, [
        at('stats', 'Columns D:F', 'Update the event’s numbers', 'D:F'),
      ], { branch: 'Both paths meet here' }),
      // 39 · Google Sheets (Archive)
      step(<>Go back to <b>LIST MAKING CHECKLIST → Attendance Extracted</b>. In the header menu bar, find <b>“Custom Tools”</b>, click <b>“Archive Event”</b>, and then click <b>“Clear Archive Attendance”</b>.</>, [
        at('attendance', 'Header menu: Custom Tools → Archive Event, then Clear Archive Attendance', 'Click both, in that order'),
      ], { note: '“Clear Archive Attendance” is scheduled for maintenance at the moment.' }),
    ],
    ifItBreaks: [
      <><b>Custom Tools</b> menu missing or showing an error: reload the sheet once.</>,
      <>Nothing matches after Match Attendance: the Event Registration tab doesn’t hold this event yet. Redo steps 4–5 with the right date, then run Match Attendance again.</>,
      <><b>Clear Archive Attendance</b> is under maintenance right now: if it fails, leave the tab as it is and tell Miguel (tech).</>,
      <>Never run the tools from the Apps Script editor.</>,
      <>The bot never replied “Attendance extracted” (or replied “⚠️ Couldn’t process”): tell Miguel in #cw-assistant with the link to Tara’s post.</>,
    ],
  },
  {
    id: 'EV-03',
    title: 'Upcoming Half-Day Event Numbers (Daily Huddle report)',
    department: 'events',
    main: 'andrea',
    poc: null,
    when: 'Weekdays, before the Daily Huddle',
    sheets: [],
    versions: [
      { v: 1, date: 'Oct 23, 2026', by: 'Miguel', what: 'First version.' },
      { v: 2, date: 'Oct 26, 2026', by: 'Miguel', what: 'Laid out in the 7-part SOP structure (Scope, Purpose, Responsibilities, Materials and Tools, Execution Sequence, Safety Guidelines, Review and Update). Scope, Purpose, Responsibilities and Safety are drafts for Miguel to check.' },
    ],
    scope: <>Every weekday, before the Daily Huddle. It covers presenting the bot’s <b>Upcoming Half-Day Event Numbers</b> report. Building the charts by hand is only for when the report doesn’t arrive (see If it breaks).</>,
    purpose: <>Give the Daily Huddle the current numbers for the upcoming half-day events without anyone building charts by hand.</>,
    responsibilities: [
      { who: 'Claude (the bot)', does: <>Around 6:00 AM PT on weekdays, posts the report images in #cw-team and sends the images plus a PPTX to Andrea by DM.</> },
      { who: 'Andrea (Main Admin)', does: <>Opens the PPTX and presents it at the Daily Huddle.</> },
      { who: 'POC Admin (to be named)', does: <>The same when Andrea is out.</> },
      { who: 'Miguel (Tech)', does: <>Fixes the report when a chart is missing or wrong.</> },
    ],
    safety: [
      { risk: <>Presenting an old report.</>, control: <>Check the report is today’s before the huddle.</> },
      { risk: <>A wrong number reaches the team.</>, control: <>If a number looks off, compare it with the CWU Daily Huddle page before presenting.</> },
    ],
    testRun: 'Not yet',
    status: 'draft',
    effective: 'Oct 23, 2026',
    lastReviewed: 'Oct 23, 2026',
    tools: [
      { name: 'Slack #cw-team and your DMs', note: 'Where the bot posts the report (images in #cw-team, images + PPTX by DM)' },
      { name: 'CWU Daily Huddle page', url: 'https://learning.clubwealth.com/reports', note: 'To double-check a number' },
    ],
    prerequisites: [
      <>Access to the bot’s DM in Slack, and PowerPoint or Google Slides to open the PPTX.</>,
    ],
    glossary: [
      { term: 'Stat Sheet', meaning: 'The bot’s attended / CWSocial25 / opt-ins numbers for the previous day’s event (first chart, when there was one).' },
      { term: 'Last-visit bars', meaning: 'Sign-ups and show-ups from the city’s previous visit, for comparison. A first visit has none.' },
      { term: 'CWSocial25, CW300, CWSocial27', meaning: 'Campaign codes. Their cards show New (since the last huddle) and Total sign-ups per stop.' },
    ],
    summary: 'The bot builds the huddle charts every weekday morning; present them at the Daily Huddle.',
    steps: [
      step(<>Around <b>6:00 AM PT</b> on weekdays the bot posts <b>Upcoming Half-Day Event Numbers</b> in <b>#cw-team</b> (images) and sends the same images plus a <b>PPTX</b> to Andrea by DM.</>, [
        { app: 'slack', name: '#cw-team', action: 'The report images, tagged @here' },
        { app: 'slack', name: 'Direct message from Club Wealth Assistant', action: 'Images + the PPTX' },
      ]),
      <>Open the DM and download the PPTX. The first slide is the Club Wealth cover; the rest are the charts (previous day’s event, this week’s stops, next tour on Thu/Fri, daily sign-ups, who brought them in, campaign codes, CWSocial27).</>,
      <>Present it at the Daily Huddle.</>,
      step(<>If a number looks off, compare it with the CWU Daily Huddle page (learning.clubwealth.com/reports).</>, [
        { app: 'hub', name: 'CWU → Reports → Daily Huddle', url: 'https://learning.clubwealth.com/reports', action: 'Compare the numbers' },
      ]),
      <>Log it if you covered this for Andrea: add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <>No report by 6:30 AM PT: open the CWU Daily Huddle page (learning.clubwealth.com/reports) and screenshot the charts the old way, then tell Miguel.</>,
      <>A chart is missing a stop or last-visit bars: tell Miguel in #cw-assistant with a screenshot.</>,
    ],
  },
  {
    id: 'AD-01',
    title: 'Half-Day event forms review',
    department: 'admin',
    main: 'kathleen',
    poc: null,
    when: 'The morning after each half-day event (6:00 AM PT reminder)',
    sheets: [HALF_DAY_FORMS],
    versions: [
      { v: 1, date: 'Oct 23, 2026', by: 'Miguel', what: 'First version.' },
      { v: 2, date: 'Oct 26, 2026', by: 'Miguel', what: 'Laid out in the 7-part SOP structure (Scope, Purpose, Responsibilities, Materials and Tools, Execution Sequence, Safety Guidelines, Review and Update). Scope, Purpose, Responsibilities and Safety are drafts for Miguel to check.' },
    ],
    scope: <>Every half-day event’s order forms that Tara posts in <b>#cw-halfday-event-forms-automation</b>, the morning after the event. It covers checking the rows and interest ticks the bot typed in. It doesn’t cover billing (CC-01) or the Homexa emails (AD-02).</>,
    purpose: <>Make sure every buyer’s name, contact details and interest ticks are right, because the ticks tag people in Keap and decide who goes on the 1 on 1 Coaching and Homexa lists.</>,
    responsibilities: [
      { who: 'Tara', does: <>Posts the order-form PDFs in Slack.</> },
      { who: 'Claude (the bot)', does: <>Types each person into the sheet, posts the 6:00 AM reminder, and after “done” tags Keap, saves each form page to the Keap File Box and sends the 1 on 1 Coaching CSV.</> },
      { who: 'Kathleen (Main Admin)', does: <>Checks the rows and ticks, replies done, and forwards the 1 on 1 Coaching CSV to Marcia.</> },
      { who: 'POC Admin (to be named)', does: <>The same when Kathleen is out.</> },
      { who: 'Miguel (Tech)', does: <>Fixes the bot when it can’t read a form.</> },
    ],
    safety: [
      { risk: <>Wrong Keap tags.</>, control: <>Each tick tags the person in Keap. Check every tick before replying done.</> },
      { risk: <>Rows that can’t sync to Keap.</>, control: <>Fill in every blank cell (most often a missing email) before replying done.</> },
      { risk: <>Personal details shared in the open.</>, control: <>Don’t paste phones or emails in Slack. Send the 1 on 1 Coaching CSV only to Marcia.</> },
    ],
    testRun: 'Not yet',
    status: 'draft',
    effective: 'Oct 23, 2026',
    lastReviewed: 'Oct 23, 2026',
    tools: [FORMS_CHANNEL, { ...KEAP, note: 'The bot tags people from your ticks; nothing to do in Keap yourself' }],
    prerequisites: [
      <>Edit access to Club Wealth Event Half Day Forms (tab HALF DAY FORMS 2026 v2).</>,
      <>The bot has replied <b>“Forms added”</b> on the event’s forms posts.</>,
    ],
    glossary: [
      { term: 'Interest boxes', meaning: 'The six checkboxes F–K (1 on 1 Coaching, Get Paid on Mortgage, Homexa, Investing Webinar, Yapii, Recruiting). A tick tags the person in Keap.' },
      { term: 'Keap check', meaning: 'The bot’s reply after you say done: which rows synced to Keap and which need attention.' },
      { term: 'File Box', meaning: 'Where Keap keeps a contact’s files. The bot attaches each person’s form page there.' },
      { term: 'Compiled list', meaning: 'A CSV of everyone from all of the event’s forms posts, posted by the bot.' },
    ],
    summary: 'Check the rows and interest ticks the bot typed in from the order forms, then say done so it can tag Keap and send the lists.',
    steps: [
      step(<>When Tara posts the order-form PDFs in <b>#cw-halfday-event-forms-automation</b>, the bot types each person into the sheet and replies <b>“Forms added — [City, ST] - [MM.DD.YY]”</b> with the people list.</>, [FORMS_SLACK]),
      <>At <b>6:00 AM PT</b> the bot posts a reminder: <b>“Values are added … with the boxes ticked for [City, ST]. Waiting for your review on the blank cells.”</b></>,
      step(<>Open <b>Club Wealth Event Half Day Forms → HALF DAY FORMS 2026 v2</b>. Check every new row for the event: fill in the blank cells (name, phone or email the bot couldn’t read) and fix any interest box that’s ticked wrong. The ticks are what tag people in Keap.</>, [
        at('forms', 'Columns A–E (First, Last, Cell, Email, Event Location) of the new rows', 'Fill in blanks', 'A:E'),
        at('forms', 'Columns F–K (1 on 1, Get Paid, Homexa, Investing Webinar, Yapii, Recruiting)', 'Fix wrong ticks', 'F:K'),
        at('forms', 'Column O (Keap sync status)', 'Should read “Synced …”', 'O:O'),
      ]),
      step(<>Reply <b>done</b> in the reminder’s thread (or in a forms thread, or as a new message “done [City]”).</>, [{ ...FORMS_SLACK, cells: 'The 6:00 AM reminder’s thread', action: 'Reply done' }]),
      <>The bot replies “Got it”, runs the Keap check, attaches each person’s form page to their Keap File Box, sends you the <b>1 on 1 Coaching CSV</b> by DM, and finishes with <b>“✅ Done”</b> and the reviewed compiled list.</>,
      <>Forward the 1 on 1 Coaching CSV to Marcia.</>,
      <>If the “✅ Done” reply says rows need attention, fix them (usually a missing email so the row can’t sync to Keap) and reply <b>done</b> again in the same thread.</>,
      <>Log it if you covered this for Kathleen: add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <>No “Got it” within the hour after you said done: reply <b>done</b> again in the same thread, then tell Miguel.</>,
      <>The bot replied “⚠️ Couldn’t process” on a forms PDF: tell Miguel in #cw-assistant with the link to Tara’s post.</>,
    ],
  },
  {
    id: 'AD-02',
    title: 'Homexa and Not Attended emails to Micoh',
    department: 'admin',
    main: 'kathleen',
    poc: null,
    when: 'After each half-day event, once forms are reviewed and attendance is tagged',
    sheets: [HALF_DAY_FORMS],
    versions: [
      { v: 1, date: 'Oct 23, 2026', by: 'Miguel', what: 'First version.' },
      { v: 2, date: 'Oct 26, 2026', by: 'Miguel', what: 'Laid out in the 7-part SOP structure (Scope, Purpose, Responsibilities, Materials and Tools, Execution Sequence, Safety Guidelines, Review and Update). Scope, Purpose, Responsibilities and Safety are drafts for Miguel to check.' },
    ],
    scope: <>After each half-day event, once its forms are reviewed (AD-01) and its attendance is tagged (EV-01). The email goes out on its own; this SOP covers checking it went out and fixing the tag name when it didn’t.</>,
    purpose: <>Make sure Micoh (Homexa) gets the Homexa leads and the Not Attended list for every event.</>,
    responsibilities: [
      { who: 'Claude (the bot)', does: <>Sends both lists to Micoh, cc’ing Kathleen, and posts “📧 Homexa email …” in #cw-halfday-event-forms-automation.</> },
      { who: 'Kathleen (Main Admin)', does: <>Checks the email went out and fixes the Not Attended tag name in Keap when it didn’t.</> },
      { who: 'POC Admin (to be named)', does: <>The same when Kathleen is out.</> },
      { who: 'Miguel (Tech)', does: <>Re-sends by hand when the bot can’t.</> },
    ],
    safety: [
      { risk: <>The email never goes out.</>, control: <>The Not Attended tag must be named exactly “Non-Attended - [City] [ST] - [MM-DD-YYYY]”. Check the spelling in Keap.</> },
      { risk: <>The lists sent twice or to the wrong person.</>, control: <>Don’t email the lists yourself. Tell Miguel; he re-sends.</> },
    ],
    testRun: 'Not yet',
    status: 'draft',
    effective: 'Oct 23, 2026',
    lastReviewed: 'Oct 26, 2026',
    tools: [FORMS_CHANNEL, { ...KEAP, note: 'Tags, to check the Not Attended tag’s name' }],
    prerequisites: [
      <>The event’s forms are reviewed (AD-01) and its attendance is tagged (EV-01).</>,
    ],
    additionalInfo: [<>This task runs on its own. You only step in when the email is late.</>],
    glossary: [
      { term: 'Micoh', meaning: 'Homexa’s lead manager (leads@homexa.com), who receives both lists.' },
      { term: 'Homexa leads', meaning: 'People whose Homexa box is ticked on the forms sheet.' },
      { term: 'Not Attended list', meaning: 'Everyone on the event’s Not-Attended tag in Keap.' },
    ],
    summary: 'The bot emails Micoh the Homexa leads and the Not Attended list; check it went out and fix the tag name if it didn’t.',
    steps: [
      <>This one runs on its own. It sends once the forms are reviewed (AD-01) and the event’s attendance is tagged (EV-01).</>,
      <>Look for the bot’s message in <b>#cw-halfday-event-forms-automation</b>: <b>“📧 Homexa email — [City, ST] — [date]: sent to Micoh …”</b> with the number of Homexa leads and Not Attended people. You’re cc’d on the emails.</>,
      step(<>If it hasn’t gone out a few hours after the tagging is done, open Keap → tags and check the event’s Not Attended tag is named exactly <b>Non-Attended - [City] [ST] - [MM-DD-YYYY]</b> (with a space on both sides of the first dash). A typo like “Non-Attended- …” stops the email.</>, [
        { app: 'keap', name: 'Keap → CRM settings → Tags (category Events)', url: 'https://app.infusionsoft.com', cells: 'Non-Attended - [City] [ST] - [MM-DD-YYYY]', action: 'Check the spelling' },
      ]),
      <>Log it if you covered this for Kathleen: add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <>The bot posted “⚠️ Homexa email … couldn’t send”: tell Miguel; he re-sends by hand.</>,
    ],
  },
  {
    id: 'CC-01',
    title: 'Half-Day event confirmation and billing',
    department: 'client-care',
    main: 'jizel',
    poc: null,
    when: 'The morning after each half-day event (6:00 AM PT reminder)',
    sheets: [HALF_DAY_FORMS],
    versions: [
      { v: 1, date: 'Oct 23, 2026', by: 'Miguel', what: 'First version.' },
      { v: 2, date: 'Oct 26, 2026', by: 'Miguel', what: 'Laid out in the 7-part SOP structure (Scope, Purpose, Responsibilities, Materials and Tools, Execution Sequence, Safety Guidelines, Review and Update). Scope, Purpose, Responsibilities and Safety are drafts for Miguel to check.' },
    ],
    scope: <>Every person who bought at a half-day event, the morning after the event. It covers confirmation, billing and the manual Keap tags for each order form.</>,
    purpose: <>Make sure every buyer is confirmed, billed correctly and tagged in Keap.</>,
    responsibilities: [
      { who: 'Claude (the bot)', does: <>Tags Jizel at 6:00 AM PT with the event’s forms threads, and picks up her final list.</> },
      { who: 'Jizel (Main Admin)', does: <>Processes confirmation and billing, adds the manual Keap tags, and posts the final list tagging @Club Wealth Assistant.</> },
      { who: 'POC Admin (to be named)', does: <>The same when Jizel is out.</> },
      { who: 'Miguel (Tech)', does: <>Fixes the bot when the forms threads or the final list go wrong.</> },
    ],
    safety: [
      { risk: <>Card or billing details leaked.</>, control: <>Never post card numbers or billing details in Slack.</> },
      { risk: <>Billing from an unreadable form.</>, control: <>Ask Tara for the paper form or a new scan before billing.</> },
    ],
    testRun: 'Not yet',
    status: 'draft',
    gaps: 'Jizel: please write in the exact billing and manual-tagging steps (step 3) so a POC can follow them.',
    effective: 'Oct 23, 2026',
    lastReviewed: 'Oct 23, 2026',
    tools: [FORMS_CHANNEL, { ...KEAP, note: 'Manual tags for each order' }],
    prerequisites: [
      <>The bot’s 6:00 AM message tagging you for the event, and access to the order-form PDFs in the forms threads.</>,
    ],
    glossary: [
      { term: 'Final list', meaning: 'Your message in the forms thread listing what was processed, tagged @Club Wealth Assistant so the bot can pick it up.' },
    ],
    summary: 'Process the confirmation and billing for each person who bought at the event, then post your final list.',
    steps: [
      <>At <b>6:00 AM PT</b> the bot tags you in <b>#cw-halfday-event-forms-automation</b>: <b>“The [City, ST] half-day event files are saved here in this channel. Please process the confirmation and billing for [City, ST]…”</b></>,
      <>Open the event’s forms threads in that channel (Tara’s PDF posts with the bot’s “Forms added” reply). The forms are the order forms with the payment details.</>,
      <>Process the confirmation and billing and add the manual Keap tags for each form. <i>(Billing steps to be written in by Jizel.)</i></>,
      <>When you’re done, post your final list in the forms thread as a separate message and tag <b>@Club Wealth Assistant</b>.</>,
      <>Log it if you covered this for Jizel: add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <>A form page is unreadable or missing: ask Tara for the paper form or a new scan.</>,
      <>Never post card numbers or billing details in Slack.</>,
    ],
  },
];

export const sopById = (id: string) => SOP_ARTICLES.find((a) => a.id.toLowerCase() === id.toLowerCase());
