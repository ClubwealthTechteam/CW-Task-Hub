import Link from 'next/link';
import type { Person } from '@/config/people';
import { visibleDepartments, canManageIntegrations, isSuperAdmin } from '@/lib/access';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';
import { builtinIntegrations } from '@/lib/integrations/registry';
import { IntegrationsMenu, type MenuApp } from './IntegrationsMenu';

// White top bar in the CW University style. Team members see their workspace; super admins also get
// every department and Integrations.
export function Header({ user, current }: { user: Person; current?: string }) {
  const depts = visibleDepartments(user);
  const admin = isSuperAdmin(user);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const cur = (key: string) => (current === key ? 'page' : undefined);
  const home = admin ? '/' : `/w/${user.departments[0]}`;
  // External apps this person can open: Keap and Eventbrite have their own read-only tabs; the rest
  // are managed on the Integrations page (super admins).
  const status = Object.fromEntries(builtinIntegrations().map((i) => [i.id, i.status === 'connected']));
  const apps: MenuApp[] = [
    admin && { id: 'keap', name: 'Keap', note: 'Club Wealth’s database · view-only', href: '/keap', connected: status.keap },
    canViewEventbrite(user) && { id: 'eventbrite', name: 'Eventbrite', note: 'Events, tickets and attendees · view-only', href: '/eventbrite', connected: status.eventbrite },
    admin && { id: 'buildium', name: 'Buildium', note: 'Properties, work orders, contractors', href: '/integrations#buildium-title', connected: status.buildium },
    admin && { id: 'zapier', name: 'Zapier', note: 'Start Zaps from the hub', href: '/integrations#zap-title', connected: status.zapier },
    admin && { id: 'claude', name: 'Claude', note: 'AI inside automations', href: '/integrations', connected: status.claude },
  ].filter(Boolean) as MenuApp[];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href={home} className="brand" aria-label="CW AI Task Hub home">
          <b>CLUBWEALTH</b>
          <span>UNIVERSITY</span>
        </Link>
        <nav className="nav" aria-label="AI Task Hub">
          <Link href={home} className="hub" aria-current={cur(admin ? 'home' : user.departments[0])}>AI Task Hub <em>NEW</em></Link>
          {(admin || depts.length > 1) && depts.map((d) => (
            <Link key={d.id} href={`/w/${d.id}`} aria-current={cur(d.id)}>{d.name}</Link>
          ))}
          {apps.length > 0 && <IntegrationsMenu apps={apps} manage={canManageIntegrations(user)} active={['keap', 'eventbrite', 'integrations'].includes(current ?? '')} />}
        </nav>
        <div className="who">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <span>{user.name}</span>
          <form action="/api/auth/logout" method="post">
            <button className="linkbtn" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
