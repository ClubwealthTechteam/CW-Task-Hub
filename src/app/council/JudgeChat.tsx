'use client';

// Chat with the council's Executive Judge (super admins). Chat only: the Judge has read the council's reports
// and can talk them through and write a hand-off, but can't run, apply or change anything.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation } from '@/lib/chat/store';
import { Markdown } from '@/components/chat/Markdown';
import { halfScreen, useAutoGrow } from '@/components/chat/autogrow';

const DRAFT = /\[DRAFT\]([\s\S]*?)(?:\[\/DRAFT\]|$)/g;
const STARTERS = ['What should we fix first?', 'Is anything urgent today?', 'Write the hand-off for Claude Code'];

function parts(text: string) {
  const out: { draft: boolean; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(DRAFT)) {
    if (m.index! > last) out.push({ draft: false, text: text.slice(last, m.index) });
    out.push({ draft: true, text: m[1].trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ draft: false, text: text.slice(last) });
  return out.filter((p) => p.text.trim());
}

export function JudgeChat({ readOnly }: { readOnly?: boolean }) {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useAutoGrow(inputRef, text, halfScreen);
  const pending = conv?.messages.some((m) => m.status === 'pending') ?? false;

  const open = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
    if (res.ok) setConv((await res.json()).conversation);
  }, []);
  useEffect(() => {
    if (readOnly) return;
    fetch('/api/chat', { cache: 'no-store' }).then((r) => r.json()).then((b) => {
      const latest = (b.conversations ?? []).find((c: { judge?: boolean }) => c.judge);
      if (latest) open(latest.id);
    }).catch(() => {});
  }, [open, readOnly]);
  useEffect(() => {
    if (!pending || !conv) return;
    const t = setInterval(() => open(conv.id), 3000);
    return () => clearInterval(t);
  }, [pending, conv, open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [conv?.messages.length, pending]);

  async function send(msg = text) {
    if (!msg.trim() || busy || pending) return;
    setBusy(true); setError('');
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conv?.id, judge: true, text: msg.trim() }) });
    const b = await res.json().catch(() => ({}));
    if (res.ok) { setConv(b.conversation); setText(''); } else setError(b.error || 'Couldn’t send');
    setBusy(false);
  }
  async function copy(key: string, t: string) {
    try { await navigator.clipboard.writeText(t); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* select by hand */ }
  }

  return (
    <section className="card judge" aria-label="Executive Judge">
      <div className="judge-h">
        <span className="judge-ic" aria-hidden="true">⚖️</span>
        <div><h2>Executive Judge</h2><p className="muted small">Ask about the council’s findings. Chat only: it can’t run, apply or change anything.</p></div>
        {conv && <button className="linkbtn" onClick={() => { setConv(null); setError(''); }}>New chat</button>}
      </div>
      <div className="judge-msgs" aria-live="polite">
        {readOnly && <p className="note" style={{ margin: 0 }}>Not available while previewing someone.</p>}
        {!conv?.messages.length && !readOnly && <p className="muted small" style={{ margin: 0 }}>The Judge has read every council report. Ask what matters most, whether something is safe to ignore, or for a hand-off you can paste to Claude Code.</p>}
        {conv?.messages.map((m) => (m.role === 'user'
          ? <div key={m.id} className="m me">{m.text}</div>
          : m.status === 'pending'
            ? <div key={m.id} className="m ai"><span className="cwa-typing" aria-label="The Judge is writing"><i /><i /><i /></span></div>
            : (
              <div key={m.id} className={`m ai${m.status === 'error' ? ' err' : ''}`}>
                {parts(m.text).map((p, i) => (p.draft ? (
                  <div key={i} className="judge-draft">
                    <div className="spread"><span className="lab">Hand-off · ready to paste</span><button className="btn" onClick={() => copy(`${m.id}-${i}`, p.text)}>{copied === `${m.id}-${i}` ? 'Copied ✓' : 'Copy'}</button></div>
                    <pre>{p.text}</pre>
                  </div>
                ) : <Markdown key={i} text={p.text} />))}
              </div>
            )))}
        <div ref={endRef} />
      </div>
      {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
      {!readOnly && (
        <form className="ws-composer judge-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="judge-input" className="sr-only">Message the Executive Judge</label>
          <textarea id="judge-input" ref={inputRef} rows={2} value={text} maxLength={4000} placeholder={pending ? 'Waiting for the Judge…' : 'Ask the Judge…'}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div className="row">
            {STARTERS.map((s) => <button key={s} type="button" className="chip-btn" disabled={busy || pending} onClick={() => send(s)}>{s}</button>)}
            <span style={{ flex: 1 }} />
            <button type="submit" className="btn primary" disabled={busy || pending || !text.trim()}>Send</button>
          </div>
        </form>
      )}
    </section>
  );
}
