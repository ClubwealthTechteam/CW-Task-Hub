'use client';

// Prompt templates for Social Media content creation, in the right panel. "Copy" puts a template on the
// clipboard; "Use in chat" fills the task assistant's message box so [brackets] can be filled in there.

import { useMemo, useState } from 'react';
import { CONTENT_TEMPLATES, templatesFor, type ContentTemplate } from '@/config/content-templates';

const ASK_EVENT = 'cw-ask-assistant';
const GROUPS = ['All', ...Array.from(new Set(CONTENT_TEMPLATES.map((t) => t.group)))];

/** Shows [placeholders] highlighted so it's clear what to fill in. */
function Prompt({ text }: { text: string }) {
  return (
    <pre className="tpl-text">
      {text.split(/(\[[^\]]+\])/g).map((part, i) => (part.startsWith('[') ? <mark key={i}>{part}</mark> : part))}
    </pre>
  );
}

export function ContentTemplates({ taskId }: { taskId: string }) {
  const [group, setGroup] = useState('All');
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { mine, rest } = useMemo(() => templatesFor(taskId), [taskId]);
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

  const card = (t: ContentTemplate) => (
    <li key={t.id} className={`tpl${open === t.id ? ' open' : ''}`}>
      <button className="tpl-h" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
        <span className="tpl-title">{t.title}</span>
        <span className="tpl-hint">{t.hint}</span>
      </button>
      {open === t.id && <Prompt text={t.prompt} />}
      <div className="tpl-acts">
        <button className="btn" onClick={() => copy(t)}>{copied === t.id ? 'Copied ✓' : 'Copy'}</button>
        <button className="btn" onClick={() => use(t)}>Use in chat</button>
        {open !== t.id && <button className="linkbtn tpl-peek" onClick={() => setOpen(t.id)}>Preview</button>}
      </div>
    </li>
  );

  const a = pick(mine);
  const b = pick(rest);
  return (
    <div className="tpls">
      <p className="muted small" style={{ margin: 0 }}>Ready-made prompts for content. Fill in the <mark>[highlighted]</mark> parts, then send. Attach photos or PDFs with 📎 first when a template asks for them.</p>
      <div className="tpl-groups" role="group" aria-label="Template type">
        {GROUPS.map((g) => <button key={g} className={`chip-btn${group === g ? ' on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      {a.length > 0 && <><h5>For this task</h5><ul className="tpl-list">{a.map(card)}</ul></>}
      {b.length > 0 && <><h5>{a.length ? 'More templates' : 'Templates'}</h5><ul className="tpl-list">{b.map(card)}</ul></>}
    </div>
  );
}
