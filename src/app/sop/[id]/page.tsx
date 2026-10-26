// One SOP article, laid out like the Confluence SOP template: the overview table (name, dates, period, audience,
// exemptions, owner), prerequisites and additional information, the steps, "If it breaks", references (glossary
// and tools) and the POC log, with a contents panel linking to each part.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { departmentById } from '@/config/departments';
import { personById } from '@/config/people';
import { isDecision, sopById } from '@/data/sop';
import { DecisionStep } from '@/components/sop/DecisionStep';
import { canEditShots, outToday, shotRef, sopLog, sopShots } from '@/lib/sop';
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

        <div className="sop-layout">
          <div className="sop-body">
            <section className="card" id="overview">
              <table className="sop-meta">
                <tbody>
                  <tr><th scope="row">SOP Name</th><td><b>{a.id}</b> · {a.title}</td></tr>
                  <tr><th scope="row">Effective Date</th><td>{a.effective}</td></tr>
                  <tr><th scope="row">Effective Period</th><td>{a.when}</td></tr>
                  <tr>
                    <th scope="row">Audience Using SOP</th>
                    <td>
                      {departmentById(a.department)?.name}: {name(a.main)} (Main Admin){mainOut && <span className="pill req sop-out">Out today</span>}
                      {', '}{a.poc ? <>{name(a.poc)} (POC Admin)</> : <span className="muted">POC Admin to be named</span>}
                    </td>
                  </tr>
                  <tr><th scope="row">Exemptions</th><td>{a.exemptions ?? <span className="muted">None</span>}</td></tr>
                  <tr><th scope="row">Owner</th><td>{name(a.main)} (Main Admin). Steps are fixed with Miguel (Tech) the same day they go wrong.</td></tr>
                  <tr><th scope="row">Last Review Date</th><td>{a.lastReviewed} · {a.updated.split(' · ')[0]} {a.status === 'draft' ? <span className="pill">Draft</span> : <span className="pill live">Ready</span>}</td></tr>
                  <tr><th scope="row">Test run</th><td>{a.testRun}</td></tr>
                </tbody>
              </table>
              {a.gaps && <p className="sop-gap small">{a.gaps}</p>}
            </section>

            <div className="sop-pair">
              <section className="card" id="prerequisites">
                <h2>Prerequisites</h2>
                {a.prerequisites.length ? <ul className="sop-list">{a.prerequisites.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted small">None.</p>}
              </section>
              <section className="card" id="additional-info">
                <h2>Additional Information</h2>
                {a.additionalInfo?.length ? <ul className="sop-list">{a.additionalInfo.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted small">None.</p>}
              </section>
            </div>

            <section className="card" id="steps">
              <h2>Steps</h2>
              <ol className="sop-steps">
                {a.steps.map((s, i) => {
                  const n = i + 1;
                  const shot1 = a.shots?.[n] ?? (pasted[shotRef(n, 1)] ? `/api/sop/shot/${a.id}/${n}?v=${pasted[shotRef(n, 1)]}` : null);
                  const shot2 = pasted[shotRef(n, 2)] ? `/api/sop/shot/${a.id}/${n}?slot=2&v=${pasted[shotRef(n, 2)]}` : null;
                  return (
                    <li key={i} id={`step-${n}`} className={isDecision(s) ? 'is-decision' : undefined}>
                      {isDecision(s) ? <DecisionStep d={s} /> : s}
                      <div className="sop-shots">
                        <StepShot articleId={a.id} step={n} src={shot1} canEdit={canPaste} />
                        {(canPaste || shot2) && <StepShot articleId={a.id} step={n} slot={2} src={shot2} canEdit={canPaste} />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="card sop-breaks" id="if-it-breaks">
              <h2>If it breaks</h2>
              <ul>{a.ifItBreaks.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>

            <section className="card" id="references">
              <h2>References</h2>
              <h3 id="glossary">Glossary</h3>
              <dl className="sop-glossary">
                {a.glossary.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}</dd></div>)}
              </dl>
              <h3 id="tools">Tools to Use</h3>
              <ul className="sop-list">
                {[...a.sheets.map((t) => ({ name: t.name, url: t.url, note: 'Google Sheet' })), ...a.tools].map((t) => (
                  <li key={t.name}>
                    {t.url ? <a href={t.url} target="_blank" rel="noreferrer">{t.name}</a> : <b>{t.name}</b>}
                    {t.note && <span className="muted small"> · {t.note}</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" id="poc-log">
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
          </div>

          <nav className="card sop-toc" aria-label="Contents">
            <span className="eyebrow">Contents</span>
            <ul>
              <li><a href="#overview">Overview</a></li>
              <li><a href="#prerequisites">Prerequisites</a></li>
              <li><a href="#additional-info">Additional Information</a></li>
              <li>
                <a href="#steps">Steps</a>
                <ul>{a.steps.map((s, i) => <li key={i}><a href={`#step-${i + 1}`} className={isDecision(s) ? 'toc-decision' : undefined}>Step {i + 1}{isDecision(s) && <> · {s.short}</>}</a></li>)}</ul>
              </li>
              <li><a href="#if-it-breaks">If it breaks</a></li>
              <li>
                <a href="#references">References</a>
                <ul><li><a href="#glossary">Glossary</a></li><li><a href="#tools">Tools to Use</a></li></ul>
              </li>
              <li><a href="#poc-log">POC log</a></li>
            </ul>
          </nav>
        </div>
      </main>
    </>
  );
}
