import Link from 'next/link';
import type { Person } from '@/config/people';
import { visibleDepartments, canManageIntegrations, isSuperAdmin, eodOnly } from '@/lib/access';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';
import { builtinIntegrations } from '@/lib/integrations/registry';
import { IntegrationsMenu, type MenuApp } from './IntegrationsMenu';
import { DepartmentsMenu } from './DepartmentsMenu';
import { SearchButton } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { Icon } from './Icon';

const SOON = 'This feature will be available soon';
/** A menu item that's shown but not usable yet; hovering (or focusing) it says so. */
const Soon = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`soon ${className}`} tabIndex={0} aria-disabled="true" data-tip={SOON} aria-description={SOON}>{children}</span>
);

/** Team members' header while only EOD reports and the SOP Handbook are open to them: everything else is greyed out. */
function LockedHeader({ user, initials, current }: { user: Person; initials: string; current?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/eod" className="brand" aria-label="CW AI Task Hub · EOD reports">
          <b>CLUBWEALTH</b>
          <span>ADMIN HUB</span>
        </Link>
        <nav className="nav" aria-label="AI Task Hub">
          <Soon className="hub">AI Task Hub <em>NEW</em></Soon>
          <Soon>My workspace</Soon>
          <Link href="/eod" aria-current={current === 'sop' ? undefined : 'page'}>EOD reports</Link>
          <Link href="/sop" aria-current={current === 'sop' ? 'page' : undefined}>SOP Handbook</Link>
          <Soon>Updates</Soon>
          <Soon>Help</Soon>
          <Soon>Integrations ▾</Soon>
        </nav>
        <Soon className="hdr-search hdr-soon"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span>Search</span></Soon>
        <Soon className="bell-soon"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></Soon>
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

// White top bar in the CW University style. Team members see their workspace; super admins also get
// every department, Integrations and Admin settings.
export function Header({ user, current }: { user: Person; current?: string }) {
  const depts = visibleDepartments(user);
  const admin = isSuperAdmin(user);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  if (eodOnly(user)) return <LockedHeader user={user} initials={initials} current={current} />;
  const cur = (key: string) => (current === key ? 'page' : undefined);
  // External apps this person can open: Keap and Eventbrite have their own read-only tabs; the rest
  // are managed on the Integrations page (super admins).
  const status = Object.fromEntries(builtinIntegrations().map((i) => [i.id, i.status === 'connected']));
  const apps: MenuApp[] = [
    admin && { id: 'keap', name: 'Keap', note: 'Club Wealth’s database · view-only', href: '/keap', connected: status.keap },
    canViewEventbrite(user) && { id: 'eventbrite', name: 'Eventbrite', note: 'Events, tickets and attendees · view-only', href: '/eventbrite', connected: status.eventbrite },
    admin && { id: 'google-sheets', name: 'Google Sheets', note: 'Read the sheets people list · view-only', href: '/admin/integrations', connected: status['google-sheets'] },
    admin && { id: 'zapier', name: 'Zapier', note: 'Updates from Zaps, and starting Zaps', href: '/zapier', connected: status.zapier || Boolean(process.env.ZAPIER_INBOUND_SECRET) },
    admin && { id: 'claude', name: 'Claude', note: 'AI inside automations', href: '/admin/integrations', connected: status.claude },
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
          <Link href="/eod" aria-current={cur('eod')}>EOD reports</Link>
          <Link href="/sop" aria-current={cur('sop')}>SOP Handbook</Link>
          {admin && <Link href="/council" aria-current={cur('council')}>Council</Link>}
          <Link href="/updates" aria-current={cur('updates')}>Updates</Link>
          <Link href="/help" aria-current={cur('help')}>Help</Link>
          {apps.length > 0 && <IntegrationsMenu apps={apps} manage={canManageIntegrations(user)} active={['keap', 'eventbrite', 'zapier'].includes(current ?? '')} />}
        </nav>
        <SearchButton />
        <NotificationBell />
        {admin && <Link href="/admin" className="hdr-gear" aria-label="Admin settings" title="Admin settings" aria-current={cur('settings')}><Icon name="gear" size={19} /></Link>}
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
