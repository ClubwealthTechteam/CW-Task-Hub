// Admin settings → System updates: the current version, what still needs setting up, and a
// timeline of every feature added or changed (src/data/changelog.ts).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { storeIsPersistent } from '@/lib/store';
import { chatIsConfigured } from '@/lib/chat/routine';
import { recentErrors } from '@/lib/errors';
import { CHANGELOG, type ChangeKind } from '@/data/changelog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System updates · Admin settings · CW AI Task Hub' };

const KIND_LABEL: Record<ChangeKind, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' };
const KINDS = Object.keys(KIND_LABEL) as ChangeKind[];

const dayLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default async function SystemUpdates({ searchParams }: { searchParams: { kind?: string } }) {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  const kind = KINDS.includes(searchParams.kind as ChangeKind) ? (searchParams.kind as ChangeKind) : null;

  const errors = storeIsPersistent() ? (await recentErrors(24)).count : null;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const status = [
    { label: 'Storage', ok: storeIsPersistent(), note: storeIsPersistent() ? 'Saving data' : 'Not connected: data resets on restart' },
    { label: 'CW Assistant', ok: chatIsConfigured(), note: chatIsConfigured() ? 'Answering' : 'Off: the routine token is missing' },
    { label: 'Instant replies', ok: Boolean(process.env.ANTHROPIC_API_KEY), note: process.env.ANTHROPIC_API_KEY ? 'On' : 'Off: add ANTHROPIC_API_KEY in Vercel' },
    { label: 'Nightly backup', ok: Boolean(process.env.BACKUP_SECRET), note: process.env.BACKUP_SECRET ? 'On' : 'Off: add BACKUP_SECRET in Vercel and GitHub' },
    { label: 'Errors · 24 hours', ok: !errors, note: errors === null ? 'Not tracked without storage' : errors ? `${errors} logged, see the home page` : 'None' },
  ];

  const shown = kind ? CHANGELOG.filter((c) => c.kind === kind) : CHANGELOG;
  const days = [...new Set(shown.map((c) => c.date))];
  const count = (k: ChangeKind) => CHANGELOG.filter((c) => c.kind === k).length;

  return (
    <>
      <Header user={user} current="settings" />
      <main className="page adm">
        <AdminTabs current="updates" />

        <section className="adm-status" aria-label="System status">
          <div className="adm-ver">
            <span className="muted small">Running version</span>
            <b>{sha ?? 'Local build'}</b>
            <span className="muted small">{CHANGELOG.length} changes since launch on Oct 12</span>
          </div>
          <ul>
            {status.map((s) => (
              <li key={s.label}><i className={s.ok ? 'ok' : 'off'} aria-hidden="true" /><span><b>{s.label}</b><small>{s.note}</small></span></li>
            ))}
          </ul>
        </section>

        <section className="adm-log" aria-labelledby="log-title">
          <div className="adm-log-h">
            <div>
              <h2 id="log-title">Changes &amp; add-ons</h2>
              <p className="muted small">Every feature added to the hub, newest first.</p>
            </div>
            <nav className="adm-filter" aria-label="Show">
              <Link href="/admin/updates" aria-current={!kind ? 'true' : undefined}>All <span>{CHANGELOG.length}</span></Link>
              {KINDS.filter(count).map((k) => (
                <Link key={k} href={`/admin/updates?kind=${k}`} aria-current={kind === k ? 'true' : undefined}>{KIND_LABEL[k]} <span>{count(k)}</span></Link>
              ))}
            </nav>
          </div>

          <ol className="tl">
            {days.map((d) => (
              <li key={d} className="tl-day">
                <div className="tl-date"><b>{dayLabel(d).split(', ').slice(1).join(', ').replace(/, \d{4}$/, '')}</b><span>{dayLabel(d).split(',')[0]}</span></div>
                <ul>
                  {shown.filter((c) => c.date === d).map((c, i) => (
                    <li key={i} className="tl-item">
                      <span className={`tl-dot k-${c.kind}`} aria-hidden="true" />
                      <div>
                        <p className="tl-meta"><span className={`tl-kind k-${c.kind}`}>{KIND_LABEL[c.kind]}</span><span>{c.area}</span></p>
                        <h3>{c.title}</h3>
                        {c.detail && <p className="tl-detail">{c.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
