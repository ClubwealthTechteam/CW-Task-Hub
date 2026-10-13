'use client';

// CW Assistant as a Messenger-style bubble in the bottom-right corner of every page.
// Open → a small chat window; maximize → a large window with the chat list beside it; minimize → back to the bubble.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, ConversationSummary } from '@/lib/chat/store';
import { Markdown } from './Markdown';
import { bubbleMax, useAutoGrow } from './autogrow';

type Size = 'closed' | 'open' | 'max';

const POLL_MS = 3000;
const SLOW_MS = 3 * 60 * 1000;
const PREFS = 'cw-assistant';
const STARTERS = [
  'Draft a friendly reminder email for tomorrow’s event',
  'Explain what my automations will do',
  'Help me write a Google Sheets formula',
];

function loadPrefs(): { size?: Size; conv?: string } {
  try { return JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { return {}; }
}
function savePrefs(p: { size: Size; conv?: string }) {
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* private window: fine */ }
}

const Icon = {
  chat: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L5 22l4-2.1c.9.2 1.9.4 3 .4 5.5 0 10-3.9 10-8.6S17.5 3 12 3Z" fill="currentColor" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  list: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  max: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  restore: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  min: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  send: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" fill="currentColor" /></svg>,
};

export function ChatWidget({ firstName }: { firstName: string }) {
  const [size, setSize] = useState<Size>('closed');
  const [showList, setShowList] = useState(false);
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ left: number | null; limit: number | null } | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(inputRef, text, bubbleMax);

  const pending = conv?.messages.some((m) => m.status === 'pending') ?? false;
  // Task chats live in their department workspace; the bubble keeps the general ones.
  const general = list.filter((c) => !c.automationId);
  const isOpen = size !== 'closed';

  const loadList = useCallback(async () => {
    const res = await fetch('/api/chat', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    setList(body.conversations);
    setReady(body.ready);
    if (body.usage) setUsage(body.usage);
  }, []);

  const open = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
    if (res.ok) { setConv((await res.json()).conversation); return true; }
    return false;
  }, []);

  // Restore the last window size and chat on each page.
  useEffect(() => {
    const p = loadPrefs();
    if (p.size) setSize(p.size);
    if (p.conv) open(p.conv).then((ok) => { if (!ok) setConv(null); });
    loadList();
  }, [open, loadList]);

  useEffect(() => { savePrefs({ size, conv: conv?.id }); }, [size, conv?.id]);

  // While a reply is on its way, check for it every few seconds (even when minimized).
  useEffect(() => {
    if (!pending || !conv) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await fetch(`/api/chat/${conv.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const next: Conversation = (await res.json()).conversation;
      setConv(next);
      if (!next.messages.some((m) => m.status === 'pending')) {
        loadList();
        if (size === 'closed') setUnread(true);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, conv, size, loadList]);

  useEffect(() => { if (isOpen) { setUnread(false); endRef.current?.scrollIntoView({ block: 'end' }); } },
    [isOpen, conv?.messages.length, pending]);

  useEffect(() => { if (isOpen && !showList) inputRef.current?.focus(); }, [isOpen, showList, conv?.id]);

  async function send(message = text) {
    const msg = message.trim();
    if (!msg || busy || pending) return;
    setBusy(true); setError('');
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conv?.id, text: msg }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.usage) setUsage(body.usage);
    if (res.ok) { setConv(body.conversation); setText(''); setNow(Date.now()); loadList(); }
    else setError(body.error || 'Something went wrong');
    setBusy(false);
  }

  function newChat() {
    setConv(null); setText(''); setError(''); setShowList(false);
  }

  async function pick(id: string) {
    setError(''); setConfirmId(null);
    if (!(await open(id))) setError('That chat couldn’t be opened.');
    setShowList(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
    setConfirmId(null);
    if (!res.ok) { setError('That chat couldn’t be removed.'); return; }
    setList((l) => l.filter((c) => c.id !== id));
    if (conv?.id === id) setConv(null);
  }

  if (!isOpen) {
    return (
      <button className="cwa-bubble" onClick={() => setSize('open')} aria-label={unread ? 'Open CW Assistant (new reply)' : 'Open CW Assistant'}>
        {Icon.chat}
        {(unread || pending) && <span className={`cwa-dot${pending && !unread ? ' busy' : ''}`} aria-hidden="true" />}
      </button>
    );
  }

  const chats = (
    <div className={`cwa-chats${showList ? '' : ' side'}`} aria-label="Your chats">
      <button className="cwa-new" onClick={newChat}>{Icon.plus} New chat</button>
      {general.length === 0 ? <p className="cwa-none">No chats yet.</p> : (
        <ul>
          {general.map((c) => (
            <li key={c.id} aria-current={conv?.id === c.id ? 'true' : undefined}>
              {confirmId === c.id ? (
                <div className="cwa-confirm">
                  <span>Remove this chat?</span>
                  <button className="danger" onClick={() => remove(c.id)}>Remove</button>
                  <button onClick={() => setConfirmId(null)}>Keep</button>
                </div>
              ) : (
                <>
                  <button className="cwa-pick" onClick={() => pick(c.id)}>
                    <span>{c.title}</span>
                    <small>{new Date(c.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                  </button>
                  <button className="cwa-icon sm" onClick={() => setConfirmId(c.id)} aria-label={`Remove chat: ${c.title}`} title="Remove chat">{Icon.trash}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className={`cwa-window ${size}`} role="dialog" aria-label="CW Assistant">
      <header className="cwa-head">
        <div className="cwa-badge" aria-hidden="true">CW</div>
        <div className="cwa-title">
          <b>CW Assistant</b>
          <span>{pending ? 'Writing a reply…' : ready === false ? 'Not switched on yet' : usage?.limit != null ? `${usage.left} of ${usage.limit} messages left today` : 'Usually replies in 1–2 min'}</span>
        </div>
        <button className="cwa-icon cwa-listbtn" onClick={() => setShowList((v) => !v)} aria-pressed={showList} aria-label="Your chats" title="Your chats">{Icon.list}</button>
        <button className="cwa-icon" onClick={newChat} aria-label="New chat" title="New chat">{Icon.plus}</button>
        <button className="cwa-icon" onClick={() => { setSize(size === 'max' ? 'open' : 'max'); setShowList(false); }}
          aria-label={size === 'max' ? 'Make smaller' : 'Maximize'} title={size === 'max' ? 'Make smaller' : 'Maximize'}>
          {size === 'max' ? Icon.restore : Icon.max}
        </button>
        <button className="cwa-icon" onClick={() => setSize('closed')} aria-label="Minimize" title="Minimize">{Icon.min}</button>
      </header>

      <div className="cwa-body">
        {(size === 'max' || showList) && chats}
        {!showList && (
          <div className="cwa-main">
            <div className="cwa-log" aria-live="polite">
              {ready === false && <p className="cwa-note">CW Assistant isn’t switched on yet. Miguel is finishing the setup.</p>}
              {!conv?.messages.length && (
                <div className="cwa-empty">
                  <div className="cwa-badge lg" aria-hidden="true">CW</div>
                  <h2>Hi {firstName}, how can I help?</h2>
                  <div className="cwa-starters">
                    {STARTERS.map((s) => <button key={s} onClick={() => { setText(s); inputRef.current?.focus(); }}>{s}</button>)}
                  </div>
                </div>
              )}
              {conv?.messages.map((m) => (
                <div key={m.id} className={`cwa-msg ${m.role} ${m.status}`}>
                  {m.role === 'assistant' && <div className="cwa-badge sm" aria-hidden="true">CW</div>}
                  <div className="cwa-bub">
                    {m.status === 'pending' ? (
                      <span className="cwa-typing" aria-label="CW Assistant is writing">
                        <i /><i /><i />
                        {now - m.at > SLOW_MS && <small>Taking a little longer…</small>}
                      </span>
                    ) : m.role === 'assistant' ? <Markdown text={m.text} /> : <p>{m.text}</p>}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {error && <p className="cwa-note" role="alert">{error}</p>}
            <form className="cwa-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <label htmlFor="cwa-input" className="sr-only">Message CW Assistant</label>
              <textarea
                id="cwa-input" ref={inputRef} rows={1} value={text} maxLength={4000}
                placeholder={pending ? 'Waiting for the reply…' : 'Aa'}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <button type="submit" className="cwa-send" disabled={busy || pending || !text.trim() || ready === false || usage?.left === 0} aria-label="Send">{Icon.send}</button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
