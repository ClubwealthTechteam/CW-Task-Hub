// Extra instructions for the assistant on specific tasks, taken from the person's Workflow Process Form:
// what the output must look like so it can be sent or pasted without rework.

const MINUTES = `TASK GUIDE: MEETING MINUTES (Andrea → Tara)
When given a transcript or notes, reply with minutes in this order, plain text that pastes cleanly into Outlook:
Subject line: "Minutes: <topic> · <date>"
1. Attendees
2. Decisions (one line each)
3. Changes to events: what changed, before → after (dates, cities, venues, prices, speakers, promo codes)
4. Action items: person · task · due date ("no date given" when none was said)
5. Open questions for Tara
Use only what is in the transcript or notes. Never invent names, dates or numbers; write "unclear in the notes" instead. Keep it short.`;

const COACHES = `TASK GUIDE: COACHES OUTREACH (Andrea)
The process: once a state and its locations are approved and the event is published (ideally 1.5 months before), ask each coach in that state (found in Club Wealth University) whether they are available that week and will promote to their contacts. If yes: they get their own Eventbrite promo code, and an Outlook email with the code and links. Follow up every other week if no one has reached out.
When drafting: short and friendly, one clear ask, signed from Andrea, Club Wealth Events. Leave [brackets] for anything not given (promo code, link, dates). Never make up a promo code or a link. When asked for a follow-up plan, list dates every 14 days from the first ask up to the event.`;

const CALLS = `TASK GUIDE: CALL NOTES (Jowelyn: onboarding scheduling, wellness and BSM calls)
Keap notes are pasted in by Jowelyn; the hub never writes to Keap. Notes are 1–3 short sentences, start with the outcome, and end with the next step and its date. Use these wordings where they fit:
"No answer. Left voicemail and sent text." · "Spoke with client. Onboarding scheduled for <day, date, time and time zone>." · "Spoke with client. Confirmed BSM attendance." · "Spoke with client. Badge details: <name / company>."
When the same client was called before, give the new dated line to add under the existing note (keep the earlier lines as they are), never a replacement note. Ask for a time zone if a time is given without one.`;

const GUIDES: Record<string, string> = {
  'andrea-form-minutes-of-the-meeting': MINUTES,
  'andrea-2': MINUTES,
  'andrea-form-coaches-outreach': COACHES,
  'andrea-9': COACHES,
  'jowee-form-group-coaching-scheduling-and-wellness-calls': CALLS,
  'jowee-4': CALLS,
};

export const taskGuide = (taskId?: string) => (taskId && GUIDES[taskId] ? `\n\n${GUIDES[taskId]}` : '');
