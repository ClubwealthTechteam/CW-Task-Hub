'use client';

// Prompt templates for the task assistant, in the right panel. "Copy" puts a template on the
// clipboard; "Use in chat" fills the task assistant's message box so [brackets] can be filled in there.

import { useMemo, useState } from 'react';
import { templatesFor, type ContentTemplate } from '@/config/content-templates';

const ASK_EVENT = 'cw-ask-assistant';

/** Shows [placeholders] highlighted so it's clear what to fill in. */
function Prompt({ text }: { text: string }) {
  return (
    <pre className="tpl-text">
      {text.split(/(\[[^\]]+\])/g).map((part, i) => (part.startsWith('[') ? <mark key={i}>{part}</mark> : part))}
    </pre>
  );
}

export function ContentTemplates({ taskId, dept = 'social-media' }: { taskId: string; dept?: string }) {
  const [group, setGroup] = useState('All');
  const [browsing, setBrowsing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { all: deptAll, mine } = useMemo(() => templatesFor(taskId, dept), [taskId, dept]);
  const groups = useMemo(() => ['All', ...Array.from(new Set(deptAll.map((t) => t.group)))], [deptAll]);
  const pick = (list: ContentTemplate[]) => (group === 'All' ? list : list.filter((t) => t.group === group));

  async function copy(t: ContentTemplate) {
    try {
      await navigator.clipboard.writeText(t.prompt);
      setCopied(t.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setOpen(t.id); // fall back to showing it so it can be selected by hand
    }
  }
  const use = (t: ContentTemplate) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { taskId, text: t.prompt } }));

  // Compact rows: the title opens the prompt; Copy and Use sit on the right.
  const card = (t: ContentTemplate) => (
    <li key={t.id} className={`tpl${open === t.id ? ' open' : ''}`}>
      <div className="tpl-row">
        <button className="tpl-h" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} title={open === t.id ? 'Hide the prompt' : 'Show the prompt'}>
          <span className="tpl-title"><span className="tpl-caret" aria-hidden="true">{open === t.id ? '▾' : '▸'}</span>{t.title}</span>
          <span className="tpl-hint">{t.hint}</span>
        </button>
        <span className="tpl-acts">
          <button className="linkbtn" onClick={() => copy(t)}>{copied === t.id ? 'Copied ✓' : 'Copy'}</button>
          <button className="linkbtn tpl-use" onClick={() => use(t)}>Use</button>
        </span>
      </div>
      {open === t.id && <Prompt text={t.prompt} />}
    </li>
  );

  const shortlist = mine.slice(0, 3);
  const all = pick(deptAll.filter((t) => !shortlist.includes(t)));
  return (
    <div className="tpls">
      <p className="muted small" style={{ margin: 0 }}>Ready-made prompts. <b>Use</b> puts one in the chat box; fill in the <mark>[highlighted]</mark> parts, then send.</p>
      {shortlist.length > 0 && <><h5>For this task</h5><ul className="tpl-list">{shortlist.map(card)}</ul></>}
      <button className="tpl-browse" onClick={() => setBrowsing(!browsing)} aria-expanded={browsing}>
        <span>{browsing ? 'Hide templates' : shortlist.length ? 'Browse all templates' : 'Show all templates'}</span>
        <span className="wp-n">{deptAll.length - shortlist.length}</span>
        <span aria-hidden="true">{browsing ? '▴' : '▾'}</span>
      </button>
      {browsing && (
        <>
          <div className="tpl-groups" role="group" aria-label="Template type">
            {groups.map((g) => <button key={g} className={`chip-btn${group === g ? ' on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
          </div>
          <ul className="tpl-list">{all.map(card)}</ul>
        </>
      )}
    </div>
  );
}
