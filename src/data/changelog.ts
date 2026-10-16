// What changed in the hub, newest first. Shown to super admins on Admin settings → System updates.
// Add an entry whenever a feature ships: one plain sentence a team lead can understand.

export type ChangeKind = 'new' | 'improved' | 'removed' | 'fixed';

export interface ChangeEntry {
  date: string; // YYYY-MM-DD (Pacific)
  kind: ChangeKind;
  area: string;
  title: string;
  detail?: string;
}

export const CHANGELOG: ChangeEntry[] = [
  // Oct 16
  { date: '2026-10-16', kind: 'new', area: 'EOD reports', title: 'Miguel can delete EOD reports', detail: 'A Delete report button (with a confirm) on each report in Team reports, for Miguel only. The report is also removed from the EOD sheet.' },
  { date: '2026-10-16', kind: 'removed', area: 'People', title: 'JP removed from the hub', detail: 'No longer with Club Wealth: removed from Social Media, sign-in, EOD reports and the EOD sheet.' },
  { date: '2026-10-16', kind: 'new', area: 'EOD reports', title: 'EOD reports copied to the EOD Google Sheet', detail: 'Every submitted report (and any edit to it) is written to the EOD Report Submissions sheet: one tab per person with a row per task, plus an All submissions tab with a row per report. This is the hub’s only sheet it writes to.' },
  { date: '2026-10-16', kind: 'new', area: 'EOD reports', title: 'EOD reports in the hub instead of email', detail: 'Team members paste their day straight from their own EOD sheet (or the emailed PDS layout), or type it in, tick the ones they do every day, and submit at the end of the shift. Super admins fill in their own too, and see every report the moment it’s submitted, a daily-tasks shortlist, and a Find automation ideas button that asks the CW Assistant.' },
  // Oct 14
  { date: '2026-10-14', kind: 'fixed', area: 'Safety', title: 'Security update: Next.js 15', detail: 'Upgraded the framework the hub runs on (Next.js 14 → 15.5) and its CSS tool, closing every known security advisory. The package audit now finds 0 issues and runs on every change.' },
  { date: '2026-10-14', kind: 'improved', area: 'Dashboard', title: 'Tighter dashboard layout', detail: 'Updates sit at the top, Departments is compact beside Hub progress, and Team adoption and Recent activity open with View all.' },
  { date: '2026-10-14', kind: 'new', area: 'Quality', title: 'Package security audit on every change', detail: 'Added to the automatic checks; the Council can now see what the checks cover.' },
  { date: '2026-10-14', kind: 'improved', area: 'Keap', title: 'Keap shortcuts in plain language', detail: 'Pick a view, fill in normal fields like Email or Contact ID, and read the answer as a table. Raw data is still one click away.' },
  { date: '2026-10-14', kind: 'new', area: 'Hub', title: '“New version ready · Reload” notice', detail: 'When a new update goes live, anyone with the hub open gets a reload prompt, so nobody needs a new link.' },
  { date: '2026-10-14', kind: 'new', area: 'Admin', title: 'Admin settings with System updates and Integrations', detail: 'One place for super admins, opened from the gear beside the bell: this timeline of every change, and the integrations page.' },
  { date: '2026-10-14', kind: 'improved', area: 'Design', title: 'Calmer dashboard', detail: 'Fewer buttons, outlined instead of solid, and icons without circles behind them. Search closes with an ×.' },
  { date: '2026-10-14', kind: 'new', area: 'Slack', title: 'Daily celebrations in #cw-team', detail: 'Birthdays, work anniversaries and holidays posted at 6:00 AM PT with a Club Wealth poster. Skips deactivated Slack accounts.' },
  { date: '2026-10-14', kind: 'new', area: 'Automations', title: 'Automation health card and daily health check', detail: 'Every weekday the hub, routines and Zapier workflows are checked and posted to #cw-assistant.' },
  { date: '2026-10-14', kind: 'new', area: 'Assistant', title: 'Instant replies for quick questions', detail: 'Short questions stream back from Claude right away; bigger jobs still go to the routine.' },
  { date: '2026-10-14', kind: 'new', area: 'Safety', title: 'Nightly backup of the hub’s data', detail: 'Kept for 30 days as a GitHub artifact.' },
  { date: '2026-10-14', kind: 'new', area: 'Safety', title: 'Error alerts', detail: 'Page crashes and failed sends are logged and shown on the home page.' },
  { date: '2026-10-14', kind: 'new', area: 'Hub', title: 'Notifications bell', detail: 'Assistant replies, shift summaries and new updates.' },
  { date: '2026-10-14', kind: 'new', area: 'Hub', title: 'Search everything with Ctrl+K', detail: 'Pages, tasks, chats and updates.' },
  { date: '2026-10-14', kind: 'new', area: 'Dashboard', title: 'Team adoption numbers', detail: 'Who is using the hub and the assistant, over the last 14 days.' },
  { date: '2026-10-14', kind: 'new', area: 'Team members', title: 'A home page for team members', detail: 'Urgent and hot tasks, a to-do list, new Keap contacts, upcoming events and a Claude shift summary.' },
  { date: '2026-10-14', kind: 'improved', area: 'Hub', title: 'Logo renamed to Admin Hub' },
  { date: '2026-10-14', kind: 'new', area: 'Quality', title: 'Automatic checks on every change', detail: 'Type check, build and browser smoke tests before anything goes live.' },

  // Oct 13
  { date: '2026-10-13', kind: 'new', area: 'ISA', title: 'ISA daily stats flow planned', detail: 'Time Doctor and ProspectBoss data into a daily report and on-request answers in Slack.' },
  { date: '2026-10-13', kind: 'improved', area: 'Dashboard', title: 'Home page redesigned as a dashboard', detail: 'Key numbers, assistant activity, hub progress and a department chart.' },
  { date: '2026-10-13', kind: 'new', area: 'Client Care', title: 'Overdue balances board for Jizel' },
  { date: '2026-10-13', kind: 'improved', area: 'Hub', title: 'Faster page loads' },
  { date: '2026-10-13', kind: 'improved', area: 'Hub', title: 'Departments dropdown in the top bar' },
  { date: '2026-10-13', kind: 'new', area: 'Council', title: 'CW Hub Council and Executive Judge', detail: 'Six AI agents review the hub every morning; chat with the Judge and hand work to Claude Code.' },
  { date: '2026-10-13', kind: 'new', area: 'Keap', title: 'Find new clients and members in Keap', detail: 'Read-only.' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'Canva for Jay, Andrea and Liz', detail: 'Uses the company Canva account.' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'Referral Prospecting board' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'New Client Welcome Posts board', detail: 'Welcome posts are prepared automatically from new Keap clients.' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'Content prompt templates beside the assistant' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'Attached files and graphics in the assistant' },
  { date: '2026-10-13', kind: 'new', area: 'Social Media', title: 'Content calendar' },
  { date: '2026-10-13', kind: 'new', area: 'Hub', title: 'Updates and announcements' },
  { date: '2026-10-13', kind: 'new', area: 'Help', title: 'Help page, guides and a first sign-in tour' },
  { date: '2026-10-13', kind: 'new', area: 'Admin', title: '“Preview as” for super admins', detail: 'See the hub exactly as a team member does.' },
  { date: '2026-10-13', kind: 'new', area: 'Integrations', title: 'Google Sheets, read-only' },
  { date: '2026-10-13', kind: 'new', area: 'Assistant', title: 'Open email drafts in Outlook or Gmail' },
  { date: '2026-10-13', kind: 'new', area: 'Assistant', title: 'Daily limit of 20 messages per person' },
  { date: '2026-10-13', kind: 'removed', area: 'Integrations', title: 'Buildium removed' },

  // Oct 12
  { date: '2026-10-12', kind: 'new', area: 'Tasks', title: 'Process form answers become tasks with build plans and flowcharts' },
  { date: '2026-10-12', kind: 'new', area: 'Integrations', title: 'Zapier connected', detail: 'An inbox for Zap updates, a live feed, and starting approved Zaps.' },
  { date: '2026-10-12', kind: 'new', area: 'Hub', title: 'A personal access code for everyone' },
  { date: '2026-10-12', kind: 'new', area: 'Integrations', title: 'Eventbrite connected, read-only' },
  { date: '2026-10-12', kind: 'new', area: 'Integrations', title: 'Keap connected, read-only', detail: 'A Keap tab, a contact panel and live data for the assistant.' },
  { date: '2026-10-12', kind: 'new', area: 'Hub', title: 'Department workspaces', detail: 'Team members only see their own tasks.' },
  { date: '2026-10-12', kind: 'new', area: 'Assistant', title: 'CW Assistant chat bubble', detail: 'Answered by a Claude routine.' },
  { date: '2026-10-12', kind: 'removed', area: 'Integrations', title: 'Recruit CRM removed' },
  { date: '2026-10-12', kind: 'new', area: 'Hub', title: 'CW AI Task Hub launched', detail: 'Department workspaces, the audit automations, and Keap, Zapier and custom integrations.' },
];
