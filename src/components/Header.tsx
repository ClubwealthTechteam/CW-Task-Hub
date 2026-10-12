import Link from 'next/link';
import type { Person } from '@/config/people';
import { visibleDepartments, canManageIntegrations } from '@/lib/access';

export function Header({ user, current }: { user: Person; current?: string }) {
  const depts = visibleDepartments(user);
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const cur = (key: string) => (current === key ? 'page' : undefined);
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="CW Task Hub home">
          <b>CLUBWEALTH</b>
          <span>AI TASK HUB</span>
        </Link>
        <nav className="nav" aria-label="Departments">
          <Link href="/" aria-current={cur('home')}>Home</Link>
          {depts.map((d) => (
            <Link key={d.id} href={`/d/${d.id}`} aria-current={cur(d.id)}>{d.name}</Link>
          ))}
          <Link href="/assistant" aria-current={cur('assistant')}>Assistant</Link>
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
