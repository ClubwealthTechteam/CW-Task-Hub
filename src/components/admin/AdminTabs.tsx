import Link from 'next/link';
import type { ReactNode } from 'react';

// The header band of every Admin settings page (super admins only): title, the page's own
// summary (children), and the section tabs along the bottom edge.
export function AdminTabs({ current, children }: { current: 'updates' | 'integrations'; children?: ReactNode }) {
  const tabs = [
    { id: 'updates', label: 'System updates', href: '/admin/updates' },
    { id: 'integrations', label: 'Integrations', href: '/admin/integrations' },
  ] as const;
  return (
    <header className="adm-band">
      <div className="adm-title">
        <span className="eyebrow">Super admins</span>
        <h1>Admin settings</h1>
      </div>
      {children}
      <nav className="adm-tabs" aria-label="Admin settings">
        {tabs.map((t) => <Link key={t.id} href={t.href} aria-current={current === t.id ? 'page' : undefined}>{t.label}</Link>)}
      </nav>
    </header>
  );
}
