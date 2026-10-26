// One SOP article: who owns it, who covers it, the steps, the "If it breaks" fallback and the POC log.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { departmentById } from '@/config/departments';
import { personById } from '@/config/people';
import { sopById } from '@/data/sop';
import { canEditShots, outToday, sopLog, sopShots } from '@/lib/sop';
import { LogForm } from '@/components/sop/SopControls';
import { StepShot } from '@/components/sop/StepShot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = sopById((await params).id);
  return { title: a ? `${a.id} ${a.title} · SOP Handbook` : 'SOP Handbook' };
}

const name = (id: string | null) => (id ? personById(id)?.name ?? id : null);
const when = (at: number) => new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function SopArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const a = sopById((await params).id);
  if (!a) notFound();
  const [log, out, pasted] = await Promise.all([sopLog(a.id), outToday(), sopShots(a.id)]);
  const canPaste = canEditShots(user.id);
  const mainOut = out.has(a.main);

  return (
    <>
      <Header user={user} current="sop" />
      <main className="page sop">
        <Link href="/sop" className="muted small">← SOP Handbook</Link>
        <section className="hero">
          <span className="eyebrow">{a.id} · {departmentById(a.department)?.name}</span>
          <h1>{a.title}</h1>
          <p>{a.summary}</p>
        </section>

        {mainOut && (
          <p className="sop-banner" role="status">
            {name(a.main)} is out today. {a.poc ? <>{name(a.poc)} is covering: follow the steps below.</> : <>No POC is named yet: tell Miguel.</>}
          </p>
        )}

        <section className="card">
          <dl className="kv">
            <dt>Main Admin</dt><dd>{name(a.main)}{mainOut && <span className="pill req sop-out">Out today</span>}</dd>
            <dt>POC Admin</dt><dd>{name(a.poc) ?? <span className="muted">To be named</span>}</dd>
            <dt>When</dt><dd>{a.when}</dd>
            <dt>Sheet</dt>
            <dd>{a.sheets.length ? a.sheets.map((s) => <div key={s.name}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</div>) : <span className="muted">None (Slack only)</span>}</dd>
            <dt>Last updated</dt><dd>{a.updated} {a.status === 'draft' && <span className="pill">Draft</span>}</dd>
            <dt>Test run</dt><dd>{a.testRun}</dd>
          </dl>
          {a.gaps && <p className="sop-gap small">{a.gaps}</p>}
        </section>

        <section className="card">
          <h2>Steps</h2>
          <ol className="sop-steps">
            {a.steps.map((s, i) => {
              const n = i + 1;
              const shot = a.shots?.[n] ?? (pasted[n] ? `/api/sop/shot/${a.id}/${n}?v=${pasted[n]}` : null);
              return (
                <li key={i}>
                  {s}
                  <StepShot articleId={a.id} step={n} src={shot} canEdit={canPaste} />
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card sop-breaks">
          <h2>If it breaks</h2>
          <ul>{a.ifItBreaks.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>

        <section className="card">
          <h2>POC log</h2>
          <p className="muted small">Add a row each time you do this task: what was done and anything unusual. The Main Admin reads these when they’re back.</p>
          <LogForm articleId={a.id} />
          {log.length > 0 ? (
            <div className="tw">
              <table className="sop-log">
                <thead><tr><th>Date</th><th>By</th><th>What was done</th><th>Anything unusual</th></tr></thead>
                <tbody>
                  {log.map((e) => (
                    <tr key={e.at}><td data-label="Date">{when(e.at)}</td><td data-label="By">{name(e.by)}</td><td data-label="What was done">{e.what}</td><td data-label="Anything unusual">{e.unusual || <span className="muted">—</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted small">No log rows yet.</p>}
        </section>
      </main>
    </>
  );
}
