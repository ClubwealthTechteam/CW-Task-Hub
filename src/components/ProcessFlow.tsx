// A process from the Workflow Process Form drawn as nodes: one card per step (tool + the full description),
// arrows between them, and a decision that splits into YES / NO branches when the form has outcomes.

import type { FormProcess } from '@/lib/forms/submissions';

interface Chain { tool: string; text: string }

/** "Eventbrite (Make a promo code) > Outlook (Send links)" → [{tool, text}, …] */
function chain(result: string): Chain[] {
  return result.split(/\s+>\s+/).map((part) => {
    const m = part.trim().match(/^(.{1,80}?)\s*\(([\s\S]*)\)\s*$/);
    return m ? { tool: m[1].trim(), text: m[2].trim() } : { tool: '', text: part.trim() };
  }).filter((c) => c.tool || c.text);
}

/** "Is it relevant? YES" → { question, answer } */
function splitLabel(label: string) {
  const i = label.lastIndexOf('?');
  return i >= 0 ? { question: label.slice(0, i + 1).replace(/^decision:\s*/i, '').trim(), answer: label.slice(i + 1).trim() || label } : { question: '', answer: label.trim() };
}

const tone = (answer: string) => (/^y(es)?\b/i.test(answer) ? 'yes' : /^no?\b/i.test(answer) ? 'no' : 'other');
const isUrl = (s: string) => /^https?:\/\//.test(s.trim());

function Text({ value }: { value: string }) {
  if (isUrl(value)) return <a href={value.trim()} target="_blank" rel="noreferrer" className="pf-link">{value.trim()}</a>;
  return <p>{value}</p>;
}

function Node({ n, tool, text, kind = 'step' }: { n?: number; tool: string; text: string; kind?: 'step' | 'branch' }) {
  return (
    <div className={`pf-node ${kind}`}>
      <div className="pf-head">
        {n != null && <span className="pf-n">{n}</span>}
        <b>{isUrl(tool) ? 'Link' : tool || 'Step'}</b>
      </div>
      {isUrl(tool) && <Text value={tool} />}
      {text && <Text value={text} />}
    </div>
  );
}

const Arrow = () => <span className="pf-arrow" aria-hidden="true" />;

export function ProcessFlow({ process }: { process: FormProcess }) {
  const steps = process.steps;
  return (
    <figure className="pf" aria-label={`${process.title}: ${steps.length} steps`}>
      <figcaption>{process.title}</figcaption>
      <div className="pf-scroll">
        <div className="pf-row">
          {steps.map((s, i) => {
            const outcomes = s.outcomes.filter((o) => o.result || o.label);
            const question = outcomes.map((o) => splitLabel(o.label).question).find(Boolean);
            return (
              <div key={i} className="pf-seg">
                {i > 0 && <Arrow />}
                <Node n={i + 1} tool={s.tool} text={s.description} />
                {outcomes.length > 0 && (
                  <>
                    <Arrow />
                    <div className="pf-decision"><span>{question || 'Outcome?'}</span></div>
                    <div className="pf-branches">
                      {outcomes.map((o, j) => {
                        const { answer } = splitLabel(o.label);
                        return (
                          <div key={j} className={`pf-branch ${tone(answer)}`}>
                            <span className="pf-label">{answer || o.label}</span>
                            {chain(o.result).map((c, k) => (
                              <div key={k} className="pf-seg">
                                <Arrow />
                                <Node tool={c.tool} text={c.text} kind="branch" />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
