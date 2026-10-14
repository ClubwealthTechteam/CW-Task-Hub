// Everything the Ctrl+K search can jump to, for the signed-in person: pages, their tasks, their chats and
// the updates they can see. Only what they can already open elsewhere in the hub.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canManageIntegrations, canViewAutomation, isSuperAdmin, visibleDepartments } from '@/lib/access';
import { allAutomations } from '@/data/catalog';
import { departmentById } from '@/config/departments';
import { personById } from '@/config/people';
import { listConversations } from '@/lib/chat/store';
import { announcementsFor } from '@/lib/announcements';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';

export const dynamic = 'force-dynamic';

export interface SearchItem { kind: 'page' | 'task' | 'chat' | 'update'; title: string; sub: string; href?: string; chatId?: string }

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const admin = isSuperAdmin(user);
  const [tasks, convs, updates] = await Promise.all([allAutomations(), listConversations(user.id), announcementsFor(user)]);
  const taskById = new Map(tasks.map((a) => [a.id, a]));

  const pages: SearchItem[] = [
    { kind: 'page', title: 'Home', sub: admin ? 'Overview dashboard' : 'Your urgent tasks, to-dos and shift summary', href: '/' },
    ...visibleDepartments(user).map((d) => ({ kind: 'page' as const, title: admin ? `${d.name} workspace` : 'My workspace', sub: d.blurb ?? d.name, href: `/w/${d.id}` })),
    ...visibleDepartments(user).map((d) => ({ kind: 'page' as const, title: `${d.name} · sheets`, sub: 'Linked Google Sheets', href: `/w/${d.id}/sheets` })),
    ...visibleDepartments(user).map((d) => ({ kind: 'page' as const, title: `${d.name} · process forms`, sub: 'Workflow process forms', href: `/w/${d.id}/forms` })),
    { kind: 'page', title: 'Updates', sub: 'Announcements from the tech team', href: '/updates' },
    { kind: 'page', title: 'Help', sub: 'How the hub works, tutorials', href: '/help' },
    ...(admin ? [
      { kind: 'page' as const, title: 'Council', sub: 'Daily AI review of the hub', href: '/council' },
      { kind: 'page' as const, title: 'Keap', sub: 'Club Wealth’s database · view-only', href: '/keap' },
      { kind: 'page' as const, title: 'Zapier', sub: 'Updates from Zaps', href: '/zapier' },
    ] : []),
    ...(canViewEventbrite(user) ? [{ kind: 'page' as const, title: 'Eventbrite', sub: 'Events, tickets and attendees · view-only', href: '/eventbrite' }] : []),
    ...(canManageIntegrations(user) ? [{ kind: 'page' as const, title: 'Integrations', sub: 'Admin settings · connect and test apps', href: '/admin/integrations' }] : []),
    ...(isSuperAdmin(user) ? [{ kind: 'page' as const, title: 'System updates', sub: 'Admin settings · changes & add-ons timeline', href: '/admin/updates' }] : []),
  ];

  const taskItems: SearchItem[] = tasks.filter((a) => canViewAutomation(user, a)).map((a) => ({
    kind: 'task', title: a.title,
    sub: [departmentById(a.department)?.name, admin ? personById(a.ownerId)?.name : null, a.stage === 'live' ? 'Live' : 'In progress'].filter(Boolean).join(' · '),
    href: `/w/${a.department}?t=${a.id}`,
  }));

  const chatItems: SearchItem[] = convs.filter((c) => !c.judge).slice(0, 50).map((c) => {
    const task = c.automationId ? taskById.get(c.automationId) : undefined;
    return task
      ? { kind: 'chat', title: c.title, sub: `Task chat · ${task.title}`, href: `/w/${task.department}?t=${task.id}` }
      : { kind: 'chat', title: c.title, sub: 'CW Assistant chat', chatId: c.id };
  });

  const updateItems: SearchItem[] = updates.slice(0, 30).map((a) => ({ kind: 'update', title: a.title, sub: new Date(a.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), href: '/updates' }));

  return NextResponse.json({ items: [...pages, ...taskItems, ...chatItems, ...updateItems] });
}
