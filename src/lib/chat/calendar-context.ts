// For the content calendar task, give the assistant the calendar itself: overdue posts and the next
// two weeks, plus upcoming Eventbrite events, so "what's due today" or "plan next week" use real plans.

import { listPosts } from '@/lib/calendar';
import { addDays, occurrencesBetween, todayPacific } from '@/lib/calendar-dates';
import { calendarDeptForTask } from '@/lib/calendar-access';
import { upcomingEvents } from '@/lib/calendar-events';
import { personById } from '@/config/people';

const MAX_LINES = 60;

export async function calendarContext(taskId: string | undefined): Promise<string> {
  const dept = calendarDeptForTask(taskId);
  if (!dept) return '';
  const today = todayPacific();
  const posts = await listPosts(dept);
  const line = (p: (typeof posts)[number], d: string) => {
    const status = p.repeat === 'none' ? p.status : p.occurrences?.[d] ?? p.status;
    return { d, status, text: `- ${d}${p.time ? ` ${p.time}` : ''} · ${p.type} · ${p.title} · ${p.platforms.join('/') || 'no platform'} · ${status}${p.assignee ? ` · ${personById(p.assignee)?.name ?? p.assignee}` : ''}${p.repeat !== 'none' ? ` · repeats ${p.repeat}` : ''}` };
  };
  const all = posts.flatMap((p) => occurrencesBetween(p, addDays(today, -14), addDays(today, 14)).map((d) => line(p, d))).sort((a, b) => a.d.localeCompare(b.d));
  const overdue = all.filter((x) => x.d < today && x.status !== 'posted');
  const ahead = all.filter((x) => x.d >= today);
  const events = (await upcomingEvents()).filter((e) => e.date <= addDays(today, 30)).slice(0, 10);
  return [
    '',
    '',
    `CONTENT CALENDAR (Social Media, from the hub; today is ${today}, Pacific). Lines: date time · type · title · platforms · status · owner.`,
    overdue.length ? `Overdue (not marked posted):\n${overdue.map((x) => x.text).join('\n')}` : 'Overdue: none.',
    ahead.length ? `Next 14 days:\n${ahead.slice(0, MAX_LINES).map((x) => x.text).join('\n')}` : 'Next 14 days: nothing planned yet.',
    events.length ? `Upcoming Club Wealth events (Eventbrite):\n${events.map((e) => `- ${e.date}${e.time ? ` ${e.time}` : ''} · ${e.name}${e.city ? ` · ${e.city}` : ''}`).join('\n')}` : '',
    'You can read this calendar but not change it: suggest posts and the person adds them with "+ New post".',
  ].filter(Boolean).join('\n');
}
