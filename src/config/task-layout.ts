// How tasks are arranged in the workspace sidebar, and tasks that moved out of the hub.

/** Tasks shown together under one dropdown in the sidebar, in this order. */
export const TASK_GROUPS: { id: string; title: string; taskIds: string[] }[] = [
  { id: 'content-creation', title: 'Content Creation tabs', taskIds: ['jaymar-4', 'jaymar-5', 'jaymar-6'] },
];

/** Tasks handled elsewhere, so the hub doesn't show them. */
export const HANDLED_ELSEWHERE: Record<string, string> = {
  'jaymar-2': 'Birthday posts are handled by CW Assistant in Slack',
};

/** Tasks that are working in the hub now (shown as Live), with anything still to finish.
 *  Not live yet: jaymar-3 (Lead Source Tracking) and jaymar-8 (Referral Prospecting), pending clarification with Jay. */
export const LIVE_IN_HUB: Record<string, string | null> = {
  'jaymar-1': null,
  'jaymar-4': null,
  'jaymar-5': null,
  'jaymar-6': 'Sending designs to Canva still needs the Canva setup.',
  'jaymar-7': null,
  'jaymar-9': null,
  'jaymar-10': null,
};

/** People whose list shows only their Workflow Process Form tasks (their AI Audit tasks are hidden). */
export const FORM_ONLY: string[] = ['jizel'];

/** Built in the hub and being tried out by their owner (shown as In progress until confirmed live). */
export const IN_PROGRESS: string[] = [
  'jizel-form-exporting-accounts-receivable-ar',
  'jowee-form-group-coaching-scheduling-and-wellness-calls', 'jowee-4',
  'andrea-form-minutes-of-the-meeting', 'andrea-2',
  'andrea-form-coaches-outreach', 'andrea-9',
];
