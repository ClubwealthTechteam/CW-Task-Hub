// The SOP Handbook: one numbered article per recurring admin task (Miguel's Admin SOP Handbook proposal, Oct 2026).
// Each article names a Main Admin who owns the task and a POC Admin who covers it when the Main is out, and the
// steps are written so the POC can follow them on the day with no training. When a step turns out unclear or
// wrong, fix it here the same day and bump `updated`.

import type { ReactNode } from 'react';
import type { DepartmentId } from '@/config/departments';

export interface SopArticle {
  /** Department prefix + number, e.g. EV-01. Never reuse a number once it's been given out (EV-02, the manual
   *  stats backup, was retired on 2026-10-26: Andrea now covers EV-01 as its POC). */
  id: string;
  title: string;
  department: DepartmentId;
  /** Person ids from src/config/people.ts. A POC of null means one still has to be named. */
  main: string;
  poc: string | null;
  when: string;
  sheets: { name: string; url?: string }[];
  /** "v1 · Oct 2026". Bump the version whenever the steps change. */
  updated: string;
  /** Has the POC run it once while the Main watched? Only then is the article "ready". */
  testRun: string;
  status: 'draft' | 'ready';
  /** Steps whose details the Main Admin still has to write in. */
  gaps?: string;
  summary: string;
  steps: ReactNode[];
  /** Screenshot per step, by step number (1 = first step): a path under public/, e.g. '/sop/EV-01/step-1.png'.
   *  Steps without one show a pasted screenshot if there is one (see src/lib/sop.ts), else a placeholder. */
  shots?: Record<number, string>;
  ifItBreaks: ReactNode[];
}

const LIST_MAKING = { name: 'LIST MAKING CHECKLIST (Half-Day Events)', url: 'https://docs.google.com/spreadsheets/d/1mwt8MoYtxJIc5mdcDxCa0S8icLTEDWOI7Xl3z74YfPM/edit' };
const DHR = { name: 'DHR → tab Event_Registrants', url: 'https://docs.google.com/spreadsheets/d/1drBAkBOxquL5i817IBF2tmnNqLexyvGHPOsu9h201kk/edit' };
const CWSOCIAL_AUDIT = { name: 'CWSocial25 Audit → tab Tracking Report', url: 'https://docs.google.com/spreadsheets/d/1V_od_nCch8lkoE_OBPffDl9JCHPnHhtAuAM7gE-AF8s/edit' };
const EVENT_OPT_IN = { name: 'Event Opt In → tab Sheet1', url: 'https://docs.google.com/spreadsheets/d/1Dlt9zyQZQ85xk6xSrrwGH7uvsqGFvPYM4KQu3oAJQqM/edit' };
const HALF_DAY_STATS = { name: 'Half Day Event Stats → tab LABC 2026', url: 'https://docs.google.com/spreadsheets/d/1mBkjMGnbGUY0rmPhpNYBaVnRRuvTdyiqI9oD4dMVHDc/edit' };
const HALF_DAY_FORMS = { name: 'Club Wealth Event Half Day Forms → tab HALF DAY FORMS 2026 v2', url: 'https://docs.google.com/spreadsheets/d/1mh-xjBC7vs_HWEbhySukD2cxIm3yoBKbmJvteHOpY-A/edit' };

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
    summary: 'Match the attendance the bot read from the sign-in sheets to the registrations, fill in anyone missing, get the stats, then update Keap, the CWSocial25 audit, the opt-ins and the event stats.',
    steps: [
      <>Find the event. Tara posts the scanned sign-in PDF in Slack <b>#cw-half-day-registration-forms-automation</b>. The bot fills columns A–E of <b>LIST MAKING CHECKLIST → Attendance Extracted</b> and replies <b>“Attendance extracted — [City] - [Date]”</b>, tagging Ali and Andrea.</>,
      <>Open <b>LIST MAKING CHECKLIST → Attendance Extracted</b> and check the rows the bot added.</>,
      <>Open <b>DHR → Event_Registrants</b>. In cell <b>A2</b> pick the date of the event Tara’s PDF is for, then copy columns <b>C:K</b>.</>,
      <>Paste them into <b>LIST MAKING CHECKLIST → Event Registration</b>. If this tab doesn’t hold that event’s registrations, nothing will match in the next step.</>,
      <>Back in <b>Attendance Extracted</b>, open the header menu <b>Custom Tools → Match Attendance</b>. A pop-up shows, and columns <b>F:Q</b> fill in from the Event Registration tab.</>,
      <>Check column <b>J (Match Method)</b> for each row. <b>PHONE_EXACT</b> or <b>NAME_EXACT</b>: column K (Match Status) shows <b>MATCHED_REGISTRANT</b>; that person is done. <b>NO_REGISTRATION_MATCH</b>: columns F:I are blank; note those people for the next steps.</>,
      <>For each unmatched person, look for their first and last name in columns <b>A:B</b> of the <b>Event Registration</b> tab. If they’re there, copy their Email, Phone Number and Contact ID, paste them into the blank columns <b>F:I</b> of their row in Attendance Extracted, and set column <b>L (Approved)</b> to <b>Yes</b>.</>,
      <>Not in Event Registration: search for the person by name in <b>Keap</b>. Found: copy their Email, Phone Number and Contact ID (the Contact ID is the number in the browser’s address bar on their contact page) and paste them into columns <b>F:I</b>. Not found: create a new contact in Keap with their details, then fill in columns F:I the same way.</>,
      <>When every row is matched or filled in, open <b>Custom Tools → Finalize Attendance</b>. A pop-up confirms the sheet is finalized.</>,
      <>Tick the <b>Call Claude</b> box (<b>S2</b>). The bot works out Total Attended, CWSocial25 and Opt-Ins with their percentages, writes them in the sheet, and posts the <b>Stat Sheet | Updated</b> report in Tara’s Slack thread.</>,
      <>In <b>Eventbrite</b>, check the event’s check-ins for the tickets bought.</>,
      <>In <b>Keap</b>, find the people who didn’t attend and apply the <b>Not-Attended</b> tag to them.</>,
      <>In <b>Event Registration</b>, filter column <b>E (Promo Code)</b> to <b>CWSocial25</b> and note everyone listed.</>,
      <>Double-check in <b>Keap</b>: find and filter the event by its date and make sure every CWSocial25 person is there.</>,
      <>Copy the CWSocial25 rows (columns <b>A:F</b>) from Event Registration.</>,
      <>Open <b>CWSocial25 Audit → Tracking Report</b>. Scroll to the last filled row and paste into the first blank row at column <b>E</b>. If column K is blank, type <b>No</b>. Fill in A:D: Month Tag, Date, Location City and Location State.</>,
      <>Open <b>Event Opt In → Sheet1</b>, scroll to the bottom and check column <b>G (email)</b> for this event’s opt-ins. Present: nothing to do. Blank: search the person in Keap by name or phone number and type their email into the blank cell.</>,
      <>Open <b>Half Day Event Stats → LABC 2026</b> and update the event’s numbers in <b>D:F</b>: TX Sold (from Eventbrite), IFS List (from Keap), Total Showup and Eligible (the same number), and Opt-ins (the opt-ins who attended).</>,
      <>Back in <b>LIST MAKING CHECKLIST</b>, open <b>Custom Tools → Archive Event</b>, then <b>Clear Archive Attendance</b> so the tab is ready for the next event.</>,
      <>Log it. Add a row to the POC log at the bottom of this page.</>,
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
    summary: 'The bot builds the huddle charts every weekday morning; present them at the Daily Huddle.',
    steps: [
      <>Around <b>6:00 AM PT</b> on weekdays the bot posts <b>Upcoming Half-Day Event Numbers</b> in <b>#cw-team</b> (images) and sends the same images plus a <b>PPTX</b> to Andrea by DM.</>,
      <>Open the DM and download the PPTX. The first slide is the Club Wealth cover; the rest are the charts (previous day’s event, this week’s stops, next tour on Thu/Fri, daily sign-ups, who brought them in, campaign codes, CWSocial27).</>,
      <>Present it at the Daily Huddle.</>,
      <>If a number looks off, compare it with the CWU Daily Huddle page (learning.clubwealth.com/reports).</>,
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
    summary: 'Check the rows and interest ticks the bot typed in from the order forms, then say done so it can tag Keap and send the lists.',
    steps: [
      <>When Tara posts the order-form PDFs in <b>#cw-halfday-event-forms-automation</b>, the bot types each person into the sheet and replies <b>“Forms added — [City, ST] - [MM.DD.YY]”</b> with the people list.</>,
      <>At <b>6:00 AM PT</b> the bot posts a reminder: <b>“Values are added … with the boxes ticked for [City, ST]. Waiting for your review on the blank cells.”</b></>,
      <>Open <b>Club Wealth Event Half Day Forms → HALF DAY FORMS 2026 v2</b>. Check every new row for the event: fill in the blank cells (name, phone or email the bot couldn’t read) and fix any interest box that’s ticked wrong. The ticks are what tag people in Keap.</>,
      <>Reply <b>done</b> in the reminder’s thread (or in a forms thread, or as a new message “done [City]”).</>,
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
    summary: 'The bot emails Micoh the Homexa leads and the Not Attended list; check it went out and fix the tag name if it didn’t.',
    steps: [
      <>This one runs on its own. It sends once the forms are reviewed (AD-01) and the event’s attendance is tagged (EV-01, or EV-02 when Ali is out).</>,
      <>Look for the bot’s message in <b>#cw-halfday-event-forms-automation</b>: <b>“📧 Homexa email — [City, ST] — [date]: sent to Micoh …”</b> with the number of Homexa leads and Not Attended people. You’re cc’d on the emails.</>,
      <>If it hasn’t gone out a few hours after the tagging is done, open Keap → tags and check the event’s Not Attended tag is named exactly <b>Non-Attended - [City] [ST] - [MM-DD-YYYY]</b> (with a space on both sides of the first dash). A typo like “Non-Attended- …” stops the email.</>,
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
