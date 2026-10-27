// One Task Recording: Claude's summary, the detailed step-by-step guide with each step's screenshot
// (click circled in red), the Flow Canvas JSON to copy, and the raw steps the recorder captured.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { personById } from '@/config/people';
import { canView, clickFor, getRecording, pageFor } from '@/lib/task-recordings/store';
import { CANVAS_APPS, type CanvasApp } from '@/lib/task-recordings/apps';
import { RecordingActions } from '@/components/task-recordings/RecordingActions';
import { StepShotZoom } from '@/components/task-recordings/StepShotZoom';
import { AutoRefresh } from '@/components/task-recordings/AutoRefresh';

export const dynamic = 'force-dynamic';

const when = (at: number) => new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const KIND = { start: 'Start', click: 'Click', tab: 'Switched tab', page: 'Opened page', type: 'Typed', copy: 'Copied', cut: 'Cut', paste: 'Pasted', screen: 'Screenshot' } as const;

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const rec = await getRecording((await params).id);
  if (!rec || !canView(user, rec)) notFound();
  const w = rec.writeUp;
  // Sent to Claude in the last 20 minutes and not answered yet.
  const writing = rec.status === 'writing' && Date.now() - (rec.writingAt ?? rec.at) < 20 * 60_000;
  const shot = (n: number) => `/api/task-recordings/${rec.id}/shots/${n}`;

  return (
    <>
      <Header user={user} current="task-recordings" />
      <main className="page trec">
        <Link href="/task-recordings" className="muted small">← Task Recording</Link>
        <section className="hero">
          <span className="eyebrow">Task Recording · {personById(rec.owner)?.name ?? rec.owner} · {when(rec.at)}</span>
          <h1>{w?.title ?? rec.title}</h1>
          {rec.about && <p>{rec.about}</p>}
        </section>

        <section className="card">
          <RecordingActions id={rec.id} canRewrite written={Boolean(w)} />
          {writing && <p className="trec-ok small" role="status">Claude is reading the screenshots and writing the steps. This usually takes 2 to 5 minutes; this page updates by itself.</p>}
          {writing && <AutoRefresh seconds={15} />}
          {!writing && w?.by === 'basic' && <p className="sop-gap small">This write-up was made from the recording alone{rec.error ? ` (${rec.error})` : ''}. Use “Write it again with Claude” once Claude is connected.</p>}
          {!writing && !w && <p className="muted small">{rec.status === 'uploading' ? 'The screenshots are still uploading, or the upload stopped part-way. Write it up with what arrived.' : `Claude didn’t finish this one${rec.error ? ` (${rec.error})` : ''}. Press “Write it up with Claude” to try again.`}</p>}
        </section>

        {w && (
          <>
            <section className="card">
              <h2>Summary</h2>
              <ul className="trec-summary">{w.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>

            <section className="card">
              <h2>Step-by-step</h2>
              <ol className="trec-steps">
                {w.steps.map((s, i) => (
                  <li key={i} id={`step-${i + 1}`}>
                    <div className="trec-step-text">
                      <span className="pill">{CANVAS_APPS[s.app as CanvasApp] ?? s.app}</span>
                      <h3>{s.title}</h3>
                      <p>{s.action}</p>
                      {(s.sheet || s.tab || s.range || s.channel || s.link) && (
                        <dl className="trec-where">
                          {s.sheet && <><dt>Sheet</dt><dd>{s.link ? <a href={s.link} target="_blank" rel="noreferrer">{s.sheet} ↗</a> : s.sheet}</dd></>}
                          {s.tab && <><dt>Tab</dt><dd>{s.tab}</dd></>}
                          {s.range && <><dt>Cells</dt><dd>{s.range}</dd></>}
                          {s.channel && <><dt>Channel</dt><dd>{s.channel}</dd></>}
                          {!s.sheet && s.link && <><dt>Link</dt><dd><a href={s.link} target="_blank" rel="noreferrer">Open ↗</a></dd></>}
                        </dl>
                      )}
                      {s.note && <p className="sop-note small"><b>Note:</b> {s.note}</p>}
                    </div>
                    {s.shot >= 0 && <StepShotZoom src={shot(s.shot)} alt={`Step ${i + 1}: ${s.title}`} ring={clickFor(rec, s.shot)} />}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <details className="card">
          <summary><b>Raw steps recorded ({rec.steps.length})</b></summary>
          <ol className="trec-raw">
            {rec.steps.map((s, i) => (
              <li key={s.n}>
                <b>{KIND[s.kind]}</b>{s.target ? ` ${s.target}` : ''}{s.text ? ` · “${s.text}”` : ''}{s.range ? ` · ${s.tab ? `${s.tab} ` : ''}${s.range}` : ''}
                {s.note && <> · {s.note}</>}
                {(() => {
                  const url = pageFor(rec, s);
                  const prevUrl = i > 0 ? pageFor(rec, rec.steps[i - 1]) : '';
                  return (
                    <>
                      {s.title && <div className="muted small">{s.title}</div>}
                      {url && <div className="muted small">{prevUrl && url !== prevUrl ? 'Switched to ' : ''}<a href={url} target="_blank" rel="noreferrer">{url}</a></div>}
                    </>
                  );
                })()}
              </li>
            ))}
          </ol>
        </details>
      </main>
    </>
  );
}
