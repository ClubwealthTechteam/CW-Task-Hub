'use client';

// The selected task's assistant. Uses the same CW Assistant routine as the bubble, with the task attached.
// When the assistant writes something meant to be sent, it wraps it in [DRAFT]…[/DRAFT] and it shows as a
// draft card with Approve / Edit / Shorter.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation } from '@/lib/chat/store';
import { Markdown } from '@/components/chat/Markdown';
import { Icon, Sparkle } from '@/components/Icon';
import { CONTACT_EVENT, loadContact, type ChatContact } from '@/lib/chat/contact';

const POLL_MS = 3000;
const SLOW_MS = 3 * 60 * 1000;
const DRAFT = /\[DRAFT\]([\s\S]*?)(?:\[\/DRAFT\]|$)/g;

function parts(text: string) {
  const out: { kind: 'text' | 'draft'; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(DRAFT)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push({ kind: 'draft', text: m[1].trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out.filter((p) => p.text.trim());
}

interface Mail { to: string; subject: string; body: string; isEmail: boolean }

/** A draft that starts with "Subject: …" is an email; the rest is its body. The recipient is the picked Keap contact. */
function asEmail(draft: string, to: string): Mail {
  const m = draft.match(/^\s*\**subject:?\**\s*:?\s*(.+)\n+([\s\S]*)$/i);
  const subject = m ? m[1].replace(/\*+/g, '').trim() : '';
  const body = (m ? m[2] : draft).trim();
  return { to, subject, body, isEmail: Boolean(subject) || /^(hi|hello|dear|good (morning|afternoon|evening))\b/i.test(body) };
}

const MAX_URL_BODY = 1800;
const enc = encodeURIComponent;
const outlookLink = (m: Mail) => `https://outlook.office.com/mail/deeplink/compose?to=${enc(m.to)}&subject=${enc(m.subject)}&body=${enc(m.body.slice(0, MAX_URL_BODY))}`;
const gmailLink = (m: Mail) => `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(m.to)}&su=${enc(m.subject)}&body=${enc(m.body.slice(0, MAX_URL_BODY))}`;

interface Props {
  taskId: string;
  title: string;
  approveTool: string | null;
  starters: string[];
  firstName: string;
  ready: boolean;
}

export function TaskChat({ taskId, title, approveTool, starters, firstName, ready }: Props) {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [contact, setContact] = useState<ChatContact | null>(null);
  const [usage, setUsage] = useState<{ left: number | null; limit: number | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = conv?.messages.some((m) => m.status === 'pending') ?? false;

  const open = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
    if (res.ok) setConv((await res.json()).conversation);
  }, []);

  // The Keap contact picked in the side panel.
  useEffect(() => {
    setContact(loadContact(taskId));
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ taskId: string; contact: ChatContact | null }>).detail;
      if (d.taskId === taskId) setContact(d.contact);
    };
    window.addEventListener(CONTACT_EVENT, on);
    return () => window.removeEventListener(CONTACT_EVENT, on);
  }, [taskId]);

  // Pick up this task's latest chat.
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      if (res.ok) {
        const list = await res.json();
        if (list.usage) setUsage(list.usage);
        const latest = list.conversations.find((c: { automationId?: string }) => c.automationId === taskId);
        if (latest) await open(latest.id);
      }
      setLoading(false);
    })();
  }, [taskId, open]);

  useEffect(() => {
    if (!pending || !conv) return;
    const t = setInterval(() => { setNow(Date.now()); open(conv.id); }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, conv, open]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [conv?.messages.length, pending]);

  async function send(message = text) {
    const msg = message.trim();
    if (!msg || busy || pending) return;
    setBusy(true); setError('');
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv?.id, automationId: taskId, text: msg, contact }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.usage) setUsage(body.usage);
    if (res.ok) { setConv(body.conversation); setText(''); setNow(Date.now()); }
    else setError(body.error || 'Something went wrong');
    setBusy(false);
  }

  async function copy(id: string, draft: string) {
    try { await navigator.clipboard.writeText(draft); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  function draftCard(m: ChatMessage, draft: string, i: number) {
    const key = `${m.id}-${i}`;
    const mail = asEmail(draft, contact?.email ?? '');
    return (
      <div key={key} className="ws-draft">
        <span className="lab">Draft · ready for your review</span>
        {mail.subject && <p className="ws-subj"><b>Subject:</b> {mail.subject}</p>}
        <Markdown text={mail.body} />
        <div className="acts">
          <button className="btn pri" disabled title={approveTool ? `Sending through ${approveTool} switches on when this task is built` : 'Approving switches on when this task is built'}>
            {approveTool ? `Approve: send via ${approveTool}` : 'Approve'}
          </button>
          <button className="btn" disabled={pending || busy} onClick={() => { setText(`Update the draft to this:\n${draft}`); inputRef.current?.focus(); }}>Edit</button>
          <button className="btn" disabled={pending || busy} onClick={() => send('Make the draft shorter.')}>Shorter</button>
          <button className="btn" onClick={() => copy(key, mail.subject ? `${mail.subject}\n\n${mail.body}` : mail.body)}>{copied === key ? 'Copied' : 'Copy'}</button>
          {mail.isEmail && (
            <>
              <a className="btn" href={outlookLink(mail)} target="_blank" rel="noreferrer" onClick={() => copy(key, mail.body)} title="Opens a new Outlook email with this draft. Review it and press Send there.">Open in Outlook</a>
              <a className="btn" href={gmailLink(mail)} target="_blank" rel="noreferrer" onClick={() => copy(key, mail.body)} title="Opens a new Gmail email with this draft. Review it and press Send there.">Open in Gmail</a>
            </>
          )}
        </div>
        {mail.isEmail && <small className="muted">Opens a new email with the draft filled in{mail.to ? ` to ${mail.to}` : ''}. Nothing is sent until you press Send there. The text is also copied, in case it’s too long to fill in.</small>}
      </div>
    );
  }

  return (
    <main className="ws-main" aria-label={`${title} assistant`}>
      <div className="ws-mh">
        <span className="ws-bot"><Sparkle /></span>
        <b title={title}>{title}</b>
        <span className="pill p-navy">Human review on</span>
        {conv && <button className="ws-newchat" onClick={() => { setConv(null); setError(''); }}><Icon name="plus" size={14} /> New chat</button>}
      </div>

      <div className="ws-msgs" aria-live="polite">
        {!ready && <p className="note" style={{ margin: 0 }}>CW Assistant isn&apos;t switched on yet. Miguel is finishing the setup.</p>}
        {!loading && !conv?.messages.length && (
          <div className="ws-hello">
            <span className="ws-bot lg"><Sparkle size={22} /></span>
            <h2>Hi {firstName}, I&apos;m your {title} assistant.</h2>
            <p>Tell me what you&apos;re working on. I&apos;ll draft it for you, and nothing is sent until you approve it.</p>
          </div>
        )}
        {conv?.messages.map((m) => (
          m.role === 'user'
            ? <div key={m.id} className="m me">{m.text}</div>
            : m.status === 'pending'
              ? (
                <div key={m.id} className="m ai">
                  <span className="cwa-typing" aria-label="The assistant is writing"><i /><i /><i />{now - m.at > SLOW_MS && <small>Taking a little longer…</small>}</span>
                </div>
              )
              : (
                <div key={m.id} className={`m ai${m.status === 'error' ? ' err' : ''}`}>
                  {parts(m.text).map((p, i) => (p.kind === 'draft' ? draftCard(m, p.text, i) : <Markdown key={i} text={p.text} />))}
                </div>
              )
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="note" role="alert" style={{ margin: '0 26px' }}>{error}</p>}
      {contact && <div className="ws-ctx">Working on <b>{contact.name}</b> from Keap{contact.tags.length ? ` · ${contact.tags.length} tag${contact.tags.length > 1 ? 's' : ''}` : ''}</div>}
      <form className="ws-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="ws-input" className="sr-only">Message the {title} assistant</label>
        <textarea
          id="ws-input" ref={inputRef} rows={2} value={text} maxLength={4000}
          placeholder={pending ? 'Waiting for the reply…' : 'Ask the assistant or adjust the draft…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <div className="row">
          {starters.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => { setText(s); inputRef.current?.focus(); }}>{s}</button>)}
          <button type="submit" className="ws-send" disabled={busy || pending || !text.trim() || !ready || usage?.left === 0} aria-label="Send"><Icon name="send" /></button>
        </div>
      </form>
      {usage?.limit != null && (
        <p className="ws-usage">{usage.left === 0 ? `You’ve used your ${usage.limit} messages for today. They reset at midnight (Pacific).` : `${usage.left} of ${usage.limit} CW Assistant messages left today`}</p>
      )}
    </main>
  );
}
