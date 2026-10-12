import Link from 'next/link';
import type { Person } from '@/config/people';
import { visibleDepartments, canManageIntegrations, isSuperAdmin } from '@/lib/access';

// White top bar in the CW University style. Team members see their workspace; super admins also get
// every department and Integrations.
export function Header({ user, current }: { user: Person; current?: string }) {
  const depts = visibleDepartments(user);
  const admin = isSuperAdmin(user);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const cur = (key: string) => (current === key ? 'page' : undefined);
  const home = admin ? '/' : `/w/${user.departments[0]}`;
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
          {canManageIntegrations(user) && <Link href="/integrations" aria-current={cur('integrations')}>Integrations</Link>}
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
