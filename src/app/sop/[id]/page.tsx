// One SOP article, laid out in the 7-part SOP structure (Tractian's SOP guide, adopted Oct 26, 2026): 1 Scope,
// 2 Purpose, 3 Responsibilities, 4 Required Materials and Tools, 5 Execution Sequence (the steps), 6 Safety
// Guidelines (risks + controls, and "If it breaks"), 7 Review and Update (schedule, version history, adoption
// numbers and the POC log), with a contents panel linking to each part.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { departmentById } from '@/config/departments';
import { personById } from '@/config/people';
import { isDecision, isPlain, sopById, REVIEW_EVERY_DAYS, type SopArticle, type SopDraftSection } from '@/data/sop';
import { adoption, currentVersion, reviewDue } from '@/lib/sop-review';
import { WhereBox } from '@/components/sop/WhereBox';
import { DecisionStep } from '@/components/sop/DecisionStep';
import { canEditShots, outToday, shotRef, sopLog, sopShotSizes, sopShots } from '@/lib/sop';
import { LogForm } from '@/components/sop/SopControls';
import { StepShot } from '@/components/sop/StepShot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = sopById((await params).id);
  return { title: a ? `${a.id} ${a.title} · SOP Handbook` : 'SOP Handbook' };
}

const DRAFT_NOTE = 'Draft · check with Miguel';
/** Marks a section written up from the SOP guide that Miguel hasn't approved yet. */
const Draft = ({ a, part }: { a: SopArticle; part: SopDraftSection }) =>
  a.approved?.includes(part) ? null : <span className="pill sop-draft" title="Drafted from what this SOP already says. Miguel checks it before it's final.">{DRAFT_NOTE}</span>;

const SECTIONS = [
  ['scope', 'Scope'], ['purpose', 'Purpose'], ['responsibilities', 'Responsibilities'], ['materials', 'Required Materials and Tools'],
  ['steps', 'Execution Sequence'], ['safety', 'Safety Guidelines'], ['review', 'Review and Update Process'],
] as const;
const H = ({ n, children }: { n: number; children: ReactNode }) => <h2><span className="sop-sec-no">{n}</span>{children}</h2>;

const name = (id: string | null) => (id ? personById(id)?.name ?? id : null);
const when = (at: number) => new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function SopArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const a = sopById((await params).id);
  if (!a) notFound();
  const [log, out, pasted, sizes] = await Promise.all([sopLog(a.id), outToday(), sopShots(a.id), sopShotSizes(a.id)]);
  const canPaste = canEditShots(user.id);
  const mainOut = out.has(a.main);
  const review = reviewDue(a);
  const ver = currentVersion(a);
  const usage = adoption(log);

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
            <section className="card" id="scope">
              <H n={1}>Scope <Draft a={a} part="scope" /></H>
              <p>{a.scope}</p>
              <table className="sop-meta">
                <tbody>
                  <tr><th scope="row">SOP</th><td><b>{a.id}</b> · {a.title}</td></tr>
                  <tr><th scope="row">When it runs</th><td>{a.when}</td></tr>
                  <tr><th scope="row">Department</th><td>{departmentById(a.department)?.name}</td></tr>
                  <tr><th scope="row">Doesn’t apply to</th><td>{a.exemptions ?? <span className="muted">Nothing else</span>}</td></tr>
                </tbody>
              </table>
            </section>

            <section className="card" id="purpose">
              <H n={2}>Purpose <Draft a={a} part="purpose" /></H>
              <p>{a.purpose}</p>
              <p className="muted small">In short: {a.summary}</p>
            </section>

            <section className="card" id="responsibilities">
              <H n={3}>Responsibilities <Draft a={a} part="responsibilities" /></H>
              <table className="sop-meta">
                <tbody>
                  <tr>
                    <th scope="row">Main Admin (owner)</th>
                    <td>{name(a.main)}{mainOut && <span className="pill req sop-out">Out today</span>}</td>
                  </tr>
                  <tr><th scope="row">POC Admin (cover)</th><td>{a.poc ? name(a.poc) : <span className="muted">To be named</span>}</td></tr>
                </tbody>
              </table>
              <div className="tw">
                <table className="sop-resp">
                  <thead><tr><th>Who</th><th>Does</th></tr></thead>
                  <tbody>{a.responsibilities.map((r) => <tr key={r.who}><td>{r.who}</td><td>{r.does}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="card" id="materials">
              <H n={4}>Required Materials and Tools</H>
              <h3>Have these before you start</h3>
              {a.prerequisites.length ? <ul className="sop-list">{a.prerequisites.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted small">Nothing extra.</p>}
              <h3 id="tools">Sheets and apps</h3>
              <ul className="sop-list">
                {[...a.sheets.map((t) => ({ name: t.name, url: t.url, note: 'Google Sheet' })), ...a.tools].map((t) => (
                  <li key={t.name}>
                    {t.url ? <a href={t.url} target="_blank" rel="noreferrer">{t.name}</a> : <b>{t.name}</b>}
                    {t.note && <span className="muted small"> · {t.note}</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" id="steps">
              <H n={5}>Execution Sequence</H>
              {a.additionalInfo?.length ? (
                <div className="sop-know"><b>Good to know</b><ul className="sop-list">{a.additionalInfo.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              ) : null}
              {a.gaps && <p className="sop-gap small">{a.gaps}</p>}
              <ol className="sop-steps">
                {a.steps.map((s, i) => {
                  const n = i + 1;
                  const shot1 = a.shots?.[n] ?? (pasted[shotRef(n, 1)] ? `/api/sop/shot/${a.id}/${n}?v=${pasted[shotRef(n, 1)]}` : null);
                  const shot2 = pasted[shotRef(n, 2)] ? `/api/sop/shot/${a.id}/${n}?slot=2&v=${pasted[shotRef(n, 2)]}` : null;
                  return (
                    <li key={i} id={`step-${n}`} className={isDecision(s) ? 'is-decision' : undefined}>
                      {isDecision(s) ? <DecisionStep d={s} /> : isPlain(s) ? (
                        <>
                          {s.branch && <span className="sop-branch small">{s.branch}</span>}
                          {s.body}
                          {s.where && <WhereBox where={s.where} />}
                          {s.note && <p className="sop-note small"><b>Note:</b> {s.note}</p>}
                          {s.next && (
                            <a className="sop-next sop-next-plain" href={`#step-${s.next.step}`} aria-label={`Next: go to step ${s.next.step}, ${s.next.label}`}>
                              Next → <b>Step {s.next.step}</b>: {s.next.label}
                            </a>
                          )}
                        </>
                      ) : s}
                      {(canPaste || shot1 || shot2) && (
                        <div className="sop-shots">
                          {(canPaste || shot1) && <StepShot articleId={a.id} step={n} src={shot1} size={sizes[shotRef(n, 1)]} canEdit={canPaste} />}
                          {(canPaste || shot2) && <StepShot articleId={a.id} step={n} slot={2} src={shot2} size={sizes[shotRef(n, 2)]} canEdit={canPaste} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <h3 id="glossary">Terms used in the steps</h3>
              <dl className="sop-glossary">
                {a.glossary.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}</dd></div>)}
              </dl>
            </section>

            <section className="card" id="safety">
              <H n={6}>Safety Guidelines <Draft a={a} part="safety" /></H>
              <p className="muted small">The risks in this task and how each one is controlled.</p>
              <div className="tw">
                <table className="sop-resp">
                  <thead><tr><th>Risk</th><th>Control</th></tr></thead>
                  <tbody>{a.safety.map((r, i) => <tr key={i}><td>{r.risk}</td><td>{r.control}</td></tr>)}</tbody>
                </table>
              </div>
              <h3 id="if-it-breaks">If it breaks</h3>
              <ul className="sop-list sop-breaks-list">{a.ifItBreaks.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>

            <section className="card" id="review">
              <H n={7}>Review and Update Process</H>
              <table className="sop-meta">
                <tbody>
                  <tr><th scope="row">Owner</th><td>{name(a.main)} (Main Admin) keeps the steps right; Miguel (Tech) makes the change the same day a step is wrong.</td></tr>
                  <tr><th scope="row">Current version</th><td>v{ver.v} · effective {a.effective} {a.status === 'draft' ? <span className="pill">Draft</span> : <span className="pill live">Ready</span>}</td></tr>
                  <tr><th scope="row">Last reviewed</th><td>{a.lastReviewed}</td></tr>
                  <tr>
                    <th scope="row">Next review</th>
                    <td>
                      {review.due} <span className="muted small">(every {a.reviewEveryDays ?? REVIEW_EVERY_DAYS} days)</span>
                      {review.overdue ? <span className="pill req sop-out">Overdue</span> : review.days <= 14 ? <span className="pill sop-out">Due soon</span> : null}
                    </td>
                  </tr>
                  <tr><th scope="row">Test run</th><td>{a.testRun}</td></tr>
                </tbody>
              </table>

              <h3 id="versions">Version history</h3>
              <div className="tw">
                <table className="sop-resp sop-versions">
                  <thead><tr><th>Version</th><th>Date</th><th>By</th><th>What changed</th></tr></thead>
                  <tbody>{[...a.versions].reverse().map((v) => <tr key={v.v}><td>v{v.v}</td><td>{v.date}</td><td>{v.by}</td><td>{v.what}</td></tr>)}</tbody>
                </table>
              </div>

              <h3 id="adoption">Adoption</h3>
              <p className="muted small">From the POC log below: each row is one run of this task; a row with “Anything unusual” filled in counts as an issue.</p>
              <div className="sop-adopt">
                {usage.map((w) => (
                  <div key={w.days}>
                    <span className="muted small">Last {w.days} days</span>
                    <b>{w.runs} {w.runs === 1 ? 'run' : 'runs'}</b>
                    <span className={w.issues ? 'sop-issues' : 'muted small'}>{w.issues} {w.issues === 1 ? 'issue' : 'issues'}</span>
                  </div>
                ))}
              </div>

              <h3 id="poc-log">POC log</h3>
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
            <ol className="sop-toc-secs">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                  {id === 'steps' && (
                    <ul>{a.steps.map((s, i) => <li key={i}><a href={`#step-${i + 1}`} className={isDecision(s) ? 'toc-decision' : undefined}>Step {i + 1}{isDecision(s) && <> · {s.short}</>}</a></li>)}</ul>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </main>
    </>
  );
}
