import Link from 'next/link';
import type { Person } from '@/config/people';
import { visibleDepartments, canManageIntegrations, isSuperAdmin } from '@/lib/access';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';
import { builtinIntegrations } from '@/lib/integrations/registry';
import { IntegrationsMenu, type MenuApp } from './IntegrationsMenu';
import { DepartmentsMenu } from './DepartmentsMenu';

// White top bar in the CW University style. Team members see their workspace; super admins also get
// every department and Integrations.
export function Header({ user, current }: { user: Person; current?: string }) {
  const depts = visibleDepartments(user);
  const admin = isSuperAdmin(user);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const cur = (key: string) => (current === key ? 'page' : undefined);
  // External apps this person can open: Keap and Eventbrite have their own read-only tabs; the rest
  // are managed on the Integrations page (super admins).
  const status = Object.fromEntries(builtinIntegrations().map((i) => [i.id, i.status === 'connected']));
  const apps: MenuApp[] = [
    admin && { id: 'keap', name: 'Keap', note: 'Club Wealth’s database · view-only', href: '/keap', connected: status.keap },
    canViewEventbrite(user) && { id: 'eventbrite', name: 'Eventbrite', note: 'Events, tickets and attendees · view-only', href: '/eventbrite', connected: status.eventbrite },
    admin && { id: 'google-sheets', name: 'Google Sheets', note: 'Read the sheets people list · view-only', href: '/integrations', connected: status['google-sheets'] },
    admin && { id: 'zapier', name: 'Zapier', note: 'Updates from Zaps, and starting Zaps', href: '/zapier', connected: status.zapier || Boolean(process.env.ZAPIER_INBOUND_SECRET) },
    admin && { id: 'claude', name: 'Claude', note: 'AI inside automations', href: '/integrations', connected: status.claude },
  ].filter(Boolean) as MenuApp[];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="CW AI Task Hub home">
          <b>CLUBWEALTH</b>
          <span>ADMIN HUB</span>
        </Link>
        <nav className="nav" aria-label="AI Task Hub">
          <Link href="/" className="hub" aria-current={cur('home')}>AI Task Hub <em>NEW</em></Link>
          {!admin && depts.length === 1 && <Link href={`/w/${depts[0].id}`} aria-current={cur(depts[0].id)}>My workspace</Link>}
          {(admin || depts.length > 1) && (
            <DepartmentsMenu depts={depts.map((d) => ({ id: d.id, name: d.name, blurb: d.blurb, adminsOnly: d.hidden }))} current={current} />
          )}
          {admin && <Link href="/council" aria-current={cur('council')}>Council</Link>}
          <Link href="/updates" aria-current={cur('updates')}>Updates</Link>
          <Link href="/help" aria-current={cur('help')}>Help</Link>
          {apps.length > 0 && <IntegrationsMenu apps={apps} manage={canManageIntegrations(user)} active={['keap', 'eventbrite', 'zapier', 'integrations'].includes(current ?? '')} />}
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
