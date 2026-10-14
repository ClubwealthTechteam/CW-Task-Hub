import Link from 'next/link';

// The header of every Admin settings page: title and the section tabs (super admins only).
export function AdminTabs({ current }: { current: 'updates' | 'integrations' }) {
  const tabs = [
    { id: 'updates', label: 'System updates', href: '/admin/updates' },
    { id: 'integrations', label: 'Integrations', href: '/admin/integrations' },
  ] as const;
  return (
    <div className="adm-head">
      <span className="eyebrow">Super admins</span>
      <h1>Admin settings</h1>
      <nav className="adm-tabs" aria-label="Admin settings">
        {tabs.map((t) => <Link key={t.id} href={t.href} aria-current={current === t.id ? 'page' : undefined}>{t.label}</Link>)}
      </nav>
    </div>
  );
}
