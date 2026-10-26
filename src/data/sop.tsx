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
export interface SopPlain { kind: 'step'; body: ReactNode; where?: SopWhere[] }

export type SopStep = ReactNode | SopPlain | SopDecision;

export const isPlain = (s: SopStep): s is SopPlain =>
  typeof s === 'object' && s !== null && !Array.isArray(s) && (s as SopPlain).kind === 'step';
export const stepWhere = (s: SopStep): SopWhere[] => (isPlain(s) || isDecision(s) ? s.where ?? [] : []);

export const isDecision = (s: SopStep): s is SopDecision =>
  typeof s === 'object' && s !== null && !Array.isArray(s) && (s as SopDecision).kind === 'decision';

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
  /** "v1 · Oct 2026". Bump the version whenever the steps change. */
  updated: string;
  /** When this version took effect, and when someone last checked the steps still match the work. */
  effective: string;
  lastReviewed: string;
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
const step = (body: ReactNode, where?: SopWhere[]): SopPlain => ({ kind: 'step', body, where });
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
    updated: 'v2 · Oct 2026',
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
      <>Andrea covers this task when Ali is out and follows the same steps. There is no separate manual backup any more.</>,
      <>Tick <b>Call Claude</b> once. Ticking it again within 10 minutes does nothing; the bot is already working.</>,
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
    summary: 'Match the attendance the bot read from the sign-in sheets to the registrations, fill in anyone missing, get the stats, then update Keap, the CWSocial25 audit, the opt-ins and the event stats.',
    steps: [
      step(<>Find the event. Tara posts the scanned sign-in PDF in Slack <b>#cw-half-day-registration-forms-automation</b>. The bot fills columns A–E of <b>LIST MAKING CHECKLIST → Attendance Extracted</b> and replies <b>“Attendance extracted — [City] - [Date]”</b>, tagging Ali and Andrea.</>, [
        ATT_SLACK,
        at('attendance', 'Columns A–E (Extracted Name, Phone, Source Page, Source Type, Notes)', 'The bot fills these in', 'A1:E1'),
      ]),
      step(<>Open <b>LIST MAKING CHECKLIST → Attendance Extracted</b> and check the rows the bot added. Rows whose Notes (E) start with <b>REVIEW:</b> need a look against the PDF.</>, [
        at('attendance', 'Columns A–E, from row 2 down', 'Check every row; fix names or phones on REVIEW rows', 'A2:E2'),
      ]),
      step(<>Open <b>DHR → Event_Registrants</b>. In cell <b>A2</b> pick the date of the event Tara’s PDF is for, then copy columns <b>C:K</b>.</>, [
        at('dhr', 'A2', 'Pick the event date', 'A2'),
        at('dhr', 'Columns C:K', 'Copy the registrants', 'C:K'),
      ]),
      step(<>Paste them into <b>LIST MAKING CHECKLIST → Event Registration</b>. If this tab doesn’t hold that event’s registrations, nothing will match in the next step.</>, [
        at('registration', 'The whole tab (replace the previous event)', 'Paste what you copied from DHR'),
      ]),
      step(<>Back in <b>Attendance Extracted</b>, open the header menu <b>Custom Tools → Match Attendance</b>. A pop-up shows, and columns <b>F:Q</b> fill in from the Event Registration tab.</>, [
        at('attendance', 'Menu: Custom Tools → Match Attendance', 'Run it once'),
        at('attendance', 'Columns F:Q (Matched Name … Tagging Request ID)', 'These fill in', 'F1:Q1'),
      ]),
      {
        kind: 'decision',
        short: 'Matched?',
        ask: <>Did each person match a registration?</>,
        check: <>Look at column <b>J (Match Method)</b> in Attendance Extracted, row by row.</>,
        where: [
          at('attendance', 'Column J (Match Method)', 'Read it for each row', 'J:J'),
          at('attendance', 'Column K (Match Status)', 'MATCHED_REGISTRANT when matched', 'K:K'),
          at('attendance', 'Columns F:I (Matched Name, Email, Phone, Contact ID)', 'Blank when not matched', 'F:I'),
        ],
        paths: [
          {
            label: 'PHONE_EXACT or NAME_EXACT',
            tone: 'yes',
            means: <>Column K (Match Status) shows <b>MATCHED_REGISTRANT</b>.</>,
            todo: [<>Nothing to do for this person. They’re complete.</>],
            next: { step: 9, label: 'Finalize Attendance' },
          },
          {
            label: 'NO_REGISTRATION_MATCH',
            tone: 'no',
            means: <>Columns <b>F:I</b> are blank for this person.</>,
            todo: [<>Note the person’s name and row.</>],
            next: { step: 7, label: 'Look them up in Event Registration' },
          },
        ],
      },
      {
        kind: 'decision',
        short: 'In Event Registration?',
        ask: <>Is the person’s name in the Event Registration tab?</>,
        check: <>Search columns <b>A:B</b> (first and last name) of <b>LIST MAKING CHECKLIST → Event Registration</b>.</>,
        where: [
          at('registration', 'Columns A:B (First, Last name)', 'Search the name (Ctrl/⌘+F)', 'A:B'),
          at('attendance', 'Columns F:I of the person’s row', 'Paste Email, Phone, Contact ID', 'F:I'),
          at('attendance', 'Column L (Approved)', 'Set to Yes', 'L:L'),
        ],
        note: <>Do steps 7–8 for each person who didn’t match.</>,
        paths: [
          {
            label: 'Yes, found',
            tone: 'yes',
            todo: [
              <>Copy their <b>Email</b>, <b>Phone Number</b> and <b>Contact ID</b>.</>,
              <>Paste them into the blank columns <b>F:I</b> of their row in Attendance Extracted.</>,
              <>Set column <b>L (Approved)</b> to <b>Yes</b>.</>,
            ],
            next: { step: 9, label: 'Finalize Attendance (once everyone is filled in)' },
          },
          {
            label: 'No, not there',
            tone: 'no',
            todo: [<>Nothing to copy from the sheet. Look for them in Keap instead.</>],
            next: { step: 8, label: 'Look them up in Keap' },
          },
        ],
      },
      {
        kind: 'decision',
        short: 'In Keap?',
        ask: <>Is the person in Keap?</>,
        check: <>Search <b>Keap</b> for the person by name.</>,
        where: [
          KEAP_CONTACTS,
          at('attendance', 'Columns F:I of the person’s row', 'Paste Email, Phone, Contact ID', 'F:I'),
        ],
        paths: [
          {
            label: 'Found in Keap',
            tone: 'yes',
            todo: [
              <>Copy their <b>Email</b>, <b>Phone Number</b> and <b>Contact ID</b>. The Contact ID is the number in the browser’s address bar on their contact page.</>,
              <>Paste them into the blank columns <b>F:I</b> of their row in Attendance Extracted.</>,
            ],
            next: { step: 9, label: 'Finalize Attendance (once everyone is filled in)' },
          },
          {
            label: 'Not found in Keap',
            tone: 'no',
            todo: [
              <>Create a new contact in Keap with their name, email and phone.</>,
              <>Copy the new contact’s <b>Email</b>, <b>Phone Number</b> and <b>Contact ID</b> into columns <b>F:I</b> of their row.</>,
            ],
            next: { step: 9, label: 'Finalize Attendance (once everyone is filled in)' },
          },
        ],
      },
      step(<>When every row is matched or filled in, open <b>Custom Tools → Finalize Attendance</b>. A pop-up confirms the sheet is finalized.</>, [
        at('attendance', 'Menu: Custom Tools → Finalize Attendance', 'Run it once'),
      ]),
      step(<>Tick the <b>Call Claude</b> box (<b>S2</b>). The bot works out Total Attended, CWSocial25 and Opt-Ins with their percentages, writes them in the sheet, and posts the <b>Stat Sheet | Updated</b> report in Tara’s Slack thread.</>, [
        at('attendance', 'S2 (Call Claude checkbox)', 'Tick it once', 'S2'),
        at('attendance', 'T2:V2 counts, T4:V4 percentages', 'The bot fills these', 'T2:V4'),
        { ...ATT_SLACK, cells: 'Tara’s thread', action: 'The bot posts the Stat Sheet here' },
      ]),
      step(<>In <b>Eventbrite</b>, check the event’s check-ins for the tickets bought.</>, [
        { app: 'eventbrite', name: 'Eventbrite → Events → this event → Orders / Check-in', url: 'https://www.eventbrite.com/organizations/events', action: 'Compare check-ins with tickets sold' },
      ]),
      step(<>In <b>Keap</b>, find the people who didn’t attend and apply the <b>Not-Attended</b> tag to them.</>, [
        { app: 'keap', name: 'Keap → Contacts (filter by the event’s registration tag)', url: 'https://app.infusionsoft.com', cells: 'Tag: Non-Attended - [City] [ST] - [MM-DD-YYYY]', action: 'Apply to everyone who didn’t attend' },
      ]),
      step(<>In <b>Event Registration</b>, filter column <b>E (Promo Code)</b> to <b>CWSocial25</b> and note everyone listed.</>, [
        at('registration', 'Column E (Promo Code) = CWSocial25', 'Filter, then note everyone', 'E:E'),
      ]),
      step(<>Double-check in <b>Keap</b>: find and filter the event by its date and make sure every CWSocial25 person is there.</>, [
        { app: 'keap', name: 'Keap → Contacts (filter by the event and date)', url: 'https://app.infusionsoft.com', action: 'Make sure each CWSocial25 person is there' },
      ]),
      step(<>Copy the CWSocial25 rows (columns <b>A:F</b>) from Event Registration.</>, [
        at('registration', 'Columns A:F of the CWSocial25 rows (filter still on)', 'Copy', 'A:F'),
      ]),
      step(<>Open <b>CWSocial25 Audit → Tracking Report</b>. Scroll to the last filled row and paste into the first blank row at column <b>E</b>. If column K is blank, type <b>No</b>. Fill in A:D: Month Tag, Date, Location City and Location State.</>, [
        at('audit', 'Column E, first blank row at the bottom', 'Paste the CWSocial25 rows', 'E:E'),
        at('audit', 'Column K', 'Type No where it’s blank', 'K:K'),
        at('audit', 'Columns A:D (Month Tag, Date, Location City, Location State)', 'Fill in for the new rows', 'A:D'),
      ]),
      {
        kind: 'decision',
        short: 'Email there?',
        ask: <>Does each opt-in from this event have an email?</>,
        check: <>Open <b>Event Opt In → Sheet1</b>, scroll to the bottom and check column <b>G (email)</b> for this event’s opt-ins.</>,
        where: [
          at('optin', 'Column G (email), bottom rows for this event', 'Check each one', 'G:G'),
          KEAP_CONTACTS,
        ],
        paths: [
          {
            label: 'Email present',
            tone: 'yes',
            todo: [<>Nothing to do for that row.</>],
            next: { step: 18, label: 'Update Half-Day Events Stats' },
          },
          {
            label: 'Email blank',
            tone: 'no',
            todo: [
              <>Search the person in <b>Keap</b> by name or phone number.</>,
              <>Type their email into the blank cell in column G.</>,
            ],
            next: { step: 18, label: 'Update Half-Day Events Stats' },
          },
        ],
      },
      step(<>Open <b>Half-Day Events Stats → LABC2026</b> and update the event’s numbers in <b>D:F</b>: TX Sold (from Eventbrite), IFS List (from Keap), Total Showup and Eligible (the same number), and Opt-ins (the opt-ins who attended).</>, [
        at('stats', 'Columns D:F on the event’s row', 'TX Sold, IFS List, Total Showup / Eligible, Opt-ins', 'D:F'),
      ]),
      step(<>Back in <b>LIST MAKING CHECKLIST</b>, open <b>Custom Tools → Archive Event</b>, then <b>Clear Archive Attendance</b> so the tab is ready for the next event.</>, [
        at('attendance', 'Menu: Custom Tools → Archive Event, then Clear Archive Attendance', 'Run both, in that order'),
      ]),
      step(<>Log it. Add a row to the POC log at the bottom of this page.</>, [
        { app: 'hub', name: 'This page → POC log', url: '#poc-log', action: 'Add what was done and anything unusual' },
      ]),
    ],
    ifItBreaks: [
      <><b>Custom Tools</b> menu missing or showing an error: reload the sheet once.</>,
      <>Nothing matches after Match Attendance: the Event Registration tab doesn’t hold this event yet. Redo steps 3–4 with the right date, then run Match Attendance again.</>,
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
    updated: 'v1 · Oct 2026',
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
    updated: 'v1 · Oct 2026',
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
    updated: 'v1 · Oct 2026',
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
    updated: 'v1 · Oct 2026',
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
