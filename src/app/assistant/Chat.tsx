'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, ConversationSummary } from '@/lib/chat/store';
import { Markdown } from './Markdown';

const POLL_MS = 3000;
const SLOW_MS = 3 * 60 * 1000;
const STARTERS = [
  'Draft a friendly reminder email for tomorrow’s event',
  'Explain what my automations will do',
  'Help me write a Google Sheets formula',
  'Summarize this text for me',
];

export function Chat({ firstName, initialId }: { firstName: string; initialId?: string }) {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  const pending = conv?.messages.some((m) => m.status === 'pending') ?? false;

  const loadList = useCallback(async () => {
    const res = await fetch('/api/chat', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    setList(body.conversations);
    setReady(body.ready);
  }, []);

  const open = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
    if (res.ok) setConv((await res.json()).conversation);
    else setError('That chat couldn’t be opened.');
  }, []);

  useEffect(() => { loadList(); if (initialId) open(initialId); }, [loadList, open, initialId]);

  // While a reply is on its way, check for it every few seconds.
  useEffect(() => {
    if (!pending || !conv) return;
    const t = setInterval(() => { setNow(Date.now()); open(conv.id); }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, conv, open]);

  useEffect(() => {
    if (!pending) loadList();
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [conv?.messages.length, pending, loadList]);

  async function send(message = text) {
    const msg = message.trim();
    if (!msg || busy || pending) return;
    setBusy(true); setError('');
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv?.id, text: msg }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setConv(body.conversation); setText(''); setNow(Date.now());
      window.history.replaceState(null, '', `/assistant?c=${body.conversation.id}`);
    } else setError(body.error || 'Something went wrong');
    setBusy(false);
  }

  function newChat() {
    setConv(null); setText(''); setError('');
    window.history.replaceState(null, '', '/assistant');
  }

  return (
    <div className="chat">
      <aside className="chat-side card" aria-label="Your chats">
        <button className="btn primary" onClick={newChat}>+ New chat</button>
        {list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No chats yet.</p> : (
          <ul className="chat-list">
            {list.map((c) => (
              <li key={c.id}>
                <button aria-current={conv?.id === c.id ? 'true' : undefined} onClick={() => { setError(''); open(c.id); window.history.replaceState(null, '', `/assistant?c=${c.id}`); }}>
                  <span>{c.title}</span>
                  <small>{new Date(c.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="chat-main card" aria-label="CW Assistant chat">
        {ready === false && (
          <p className="note" style={{ margin: 0 }}>CW Assistant isn’t switched on yet. Miguel is finishing the setup.</p>
        )}
        <div className="chat-log" aria-live="polite">
          {!conv?.messages.length && (
            <div className="chat-empty">
              <div className="bot-badge" aria-hidden="true">CW</div>
              <h2>Hi {firstName}, how can I help?</h2>
              <div className="starters">
                {STARTERS.map((s) => <button key={s} className="chip-btn" onClick={() => setText(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {conv?.messages.map((m) => (
            <div key={m.id} className={`msg ${m.role} ${m.status}`}>
              {m.role === 'assistant' && <div className="bot-badge sm" aria-hidden="true">CW</div>}
              <div className="bubble">
                {m.status === 'pending' ? (
                  <span className="typing">
                    <i /><i /><i />
                    <span className="small muted">{now - m.at > SLOW_MS ? 'Still working on it — this one is taking a little longer.' : 'CW Assistant is writing…'}</span>
                  </span>
                ) : m.role === 'assistant' ? <Markdown text={m.text} /> : <p>{m.text}</p>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="chat-input" className="sr-only">Message CW Assistant</label>
          <textarea
            id="chat-input" rows={2} value={text} maxLength={4000}
            placeholder={pending ? 'Waiting for the reply…' : 'Message CW Assistant'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="btn primary" type="submit" disabled={busy || pending || !text.trim() || ready === false}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
        <p className="muted small" style={{ margin: 0 }}>CW Assistant can’t see your Keap, Buildium or email from here. Double-check anything important.</p>
      </section>
    </div>
  );
}
