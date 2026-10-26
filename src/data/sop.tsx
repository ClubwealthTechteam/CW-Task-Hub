// The SOP Handbook: one numbered article per recurring admin task (Miguel's Admin SOP Handbook proposal, Oct 2026).
// Each article names a Main Admin who owns the task and a POC Admin who covers it when the Main is out, and the
// steps are written so the POC can follow them on the day with no training. When a step turns out unclear or
// wrong, fix it here the same day and bump `updated`.

import type { ReactNode } from 'react';
import type { DepartmentId } from '@/config/departments';

export interface SopArticle {
  /** Department prefix + number, e.g. EV-01. Never reuse a number once it's been given out. */
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
   *  Steps without one show a placeholder until the Main Admin sends a screenshot. */
  shots?: Record<number, string>;
  ifItBreaks: ReactNode[];
}

const LIST_MAKING = { name: 'LIST MAKING CHECKLIST (Half-Day Events)', url: 'https://docs.google.com/spreadsheets/d/1mwt8MoYtxJIc5mdcDxCa0S8icLTEDWOI7Xl3z74YfPM/edit' };
const HALF_DAY_FORMS = { name: 'Club Wealth Event Half Day Forms → tab HALF DAY FORMS 2026 v2', url: 'https://docs.google.com/spreadsheets/d/1mh-xjBC7vs_HWEbhySukD2cxIm3yoBKbmJvteHOpY-A/edit' };

export const SOP_ARTICLES: SopArticle[] = [
  {
    id: 'EV-01',
    title: 'Half-Day Event attendance tagging',
    department: 'events',
    main: 'ali',
    poc: null,
    when: 'After each half-day event, once the bot replies “Attendance extracted”',
    sheets: [LIST_MAKING],
    updated: 'v1 · Oct 2026',
    testRun: 'Not yet · POC with Ali',
    status: 'draft',
    summary: 'Check the attendance the bot read from the sign-in sheets, get the stats, and tag every attendee in Keap.',
    steps: [
      <>Find the event. In Slack <b>#half-day-registration-forms</b>, open the thread with the bot’s reply <b>“Attendance extracted — [City] - [Date]”</b>.</>,
      <>Open the sheet <b>LIST MAKING CHECKLIST (Half-Day Events)</b> → tab <b>Attendance Extracted</b>. Columns A–E (name, phone, page, source type, notes) are already filled.</>,
      <>Check flagged rows. Any row whose Notes start with <b>REVIEW:</b>, compare it with the sign-in PDF in the Slack thread and correct the name or phone.</>,
      <>Mark who attended. Tab <b>Event Registration</b> → column F <b>Attended = Yes</b> for every attendee. The stats count only this column.</>,
      <>Get the stats. Back in <b>Attendance Extracted</b>, tick the <b>Call Claude</b> box (S2). Within the hour the bot posts the attended, CWSocial25 and opt-in numbers in the Slack thread.</>,
      <>Match. <b>Custom Tools → Match Attendance</b>. A pop-up shows how many matched and how many need review.</>,
      <>Resolve REVIEW rows. For each row with Match Status <b>REVIEW</b>: find the person in Event Registration or Keap, enter their Contact ID and set <b>Approved = Yes</b>. If they weren’t a real attendee, set <b>Approved = No</b> and Match Status = <b>INVALID_EXTRACTION</b>.</>,
      <>Finalize. <b>Custom Tools → Finalize Attendance</b>. This fills Event, Event Date and the Target Tag (<b>Attended - [Event] - [MM-DD-YYYY]</b>) and sets ready rows to <b>READY_TO_TAG</b>.</>,
      <>Tag in Keap. For each READY_TO_TAG row, open the contact in Keap by Contact ID, apply the Target Tag, then set Tagging Status = <b>MANUAL_DONE</b>.</>,
      <>Archive. <b>Custom Tools → Archive Event</b>. Every row must be TAGGED, MANUAL_DONE or NOT_APPLICABLE first. It saves a copy to the Attendance History sheet.</>,
      <>Clear for the next event. <b>Custom Tools → Clear Archived Attendance → Yes</b>.</>,
      <>Log it. Add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <><b>Custom Tools</b> menu missing or showing an error: reload the sheet once.</>,
      <>Still broken: skip steps 6–8, tag each attendee in Keap by hand (tag <b>Attended - [Event] - [MM-DD-YYYY]</b>), set Tagging Status = <b>MANUAL_DONE</b>, and tell Miguel (tech).</>,
      <>Never run the tools from the Apps Script editor.</>,
      <>The bot never replied “Attendance extracted” (or replied “⚠️ Couldn’t process”): tell Miguel in #cw-assistant with the link to Tara’s post.</>,
    ],
  },
  {
    id: 'EV-02',
    title: 'Half-Day event stats when Ali is out (manual backup)',
    department: 'events',
    main: 'andrea',
    poc: null,
    when: 'After each half-day event, only when Ali is out',
    sheets: [LIST_MAKING],
    updated: 'v1 · Oct 2026',
    testRun: 'Not yet · POC with Andrea',
    status: 'draft',
    summary: 'When Ali is out, type the three stats yourself and let the bot post the Stat Sheet in Slack.',
    steps: [
      <>Open <b>LIST MAKING CHECKLIST (Half-Day Events)</b> → tab <b>Attendance Extracted</b>. Use the <b>Manual Backup</b> block (columns X–AA), not Ali’s block (S–V).</>,
      <>In <b>X2</b> type the attended count like <b>32 of 165</b> (attended of registered).</>,
      <>In <b>Y2</b> type the CWSocial25 count the same way, e.g. <b>3 of 7</b>.</>,
      <>In <b>Z2</b> type the opt-ins, e.g. <b>23 of 32</b> (opt-ins of attended).</>,
      <>Tick the <b>Call Claude</b> box in <b>AA2</b>.</>,
      <>Within the hour the bot works out the percentages (X4:Z4), posts the <b>Stat Sheet | Updated</b> reply in the event’s Slack thread in #half-day-registration-forms, tags Tara, and clears the tab for the next event.</>,
      <>Log it. Add a row to the POC log at the bottom of this page.</>,
    ],
    ifItBreaks: [
      <>The bot replies “I couldn’t read Y2” (or another cell): retype it like <b>3 of 7</b> and tick AA2 again.</>,
      <>No Stat Sheet reply after an hour: check AA2 is still ticked, then tell Miguel in #cw-assistant.</>,
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
