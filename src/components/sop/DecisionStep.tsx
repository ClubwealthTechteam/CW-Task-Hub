// A decision step in an SOP article: the question, where to look, and the two paths side by side, each with its
// own short checklist and a link to the step to continue with (the YES / NO nodes of the Flow Canvas).

import type { SopDecision } from '@/data/sop';
import { WhereBox } from './WhereBox';

export function DecisionStep({ d }: { d: SopDecision }) {
  return (
    <div className="sop-decision">
      <div className="sop-ask">
        <span className="sop-ask-icon" aria-hidden="true">?</span>
        <div>
          <span className="sop-ask-kicker">Decision</span>
          <b>{d.ask}</b>
          {d.check && <div className="sop-ask-check">{d.check}</div>}
        </div>
      </div>
      {d.where && <WhereBox where={d.where} />}
      {d.note && <p className="sop-decision-note small">{d.note}</p>}
      <div className="sop-paths">
        {d.paths.map((p, i) => (
          <section key={p.label} className={`sop-path ${p.tone}`} aria-label={`If ${p.label}`}>
            <h4><span className="sop-path-tag">{i === 0 ? 'Path A' : 'Path B'}</span> If {p.label}</h4>
            {p.means && <p className="sop-path-means small">{p.means}</p>}
            <ul className="sop-path-todo">{p.todo.map((t, j) => <li key={j}>{t}</li>)}</ul>
            <a className="sop-next" href={`#step-${p.next.step}`} aria-label={`Next: go to step ${p.next.step}, ${p.next.label}`}>
              Next → <b>Step {p.next.step}</b>: {p.next.label}
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
