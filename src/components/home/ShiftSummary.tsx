'use client';

// Home page: Claude writes the person's end-of-shift summary from their notes, the to-dos they ticked off
// today and the task chats they worked in. Ready to copy into Slack.

import { useEffect, useRef, useState } from 'react';
import { Markdown } from '@/components/chat/Markdown';

const POLL_MS = 3000;
const KEY = 'cw-shift-summary';

export function ShiftSummary({ readOnly, firstName }: { readOnly?: boolean; firstName: string }) {
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState('');
  const [state, setState] = useState<'idle' | 'writing' | 'done'>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const loaded = useRef(false);

  // Keep the notes and the last summary across page loads (this browser only).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      if (s.day === today) { setNotes(s.notes || ''); setHours(s.hours || ''); setText(s.text || ''); if (s.text) setState('done'); if (s.pending) { setConvId(s.pending); setState('writing'); } }
    } catch { /* private window */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    try { localStorage.setItem(KEY, JSON.stringify({ day: today, notes, hours, text, pending: state === 'writing' ? convId : null })); } catch { /* fine */ }
  }, [notes, hours, text, state, convId]);

  useEffect(() => {
    if (state !== 'writing' || !convId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/me/shift-summary?id=${encodeURIComponent(convId)}`, { cache: 'no-store' });
      if (!res.ok) { setState('idle'); setError('The summary couldn’t be found. Try again.'); return; }
      const body = await res.json();
      if (body.status === 'pending') return;
      if (body.status === 'done') { setText(body.text); setState('done'); }
      else { setError(body.text || 'The summary didn’t arrive. Try again.'); setState('idle'); }
      setConvId(null);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [state, convId]);

  async function make() {
    setError(''); setCopied(false);
    const res = await fetch('/api/me/shift-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes, hours }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || 'Something went wrong'); return; }
    setConvId(body.conversationId); setState('writing');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Copy didn’t work here. Select the text and copy it.'); }
  }

  return (
    <section className="dcard hm-shift" aria-labelledby="hm-shift-t">
      <div className="dcard-h">
        <div><h2 id="hm-shift-t">Shift summary maker</h2><p className="muted small">Claude writes your end-of-shift summary from your notes and what you ticked off today.</p></div>
        <span className="hm-claude">Powered by Claude</span>
      </div>
      <div className="hm-shift-grid">
        <div className="hm-shift-in">
          <label className="hm-label" htmlFor="hm-hours">Shift hours <span className="muted">(optional)</span></label>
          <input id="hm-hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 7:00 AM – 4:00 PM" maxLength={30} disabled={readOnly} />
          <label className="hm-label" htmlFor="hm-notes">What did you work on today?</label>
          <textarea id="hm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={7} maxLength={3000} disabled={readOnly}
            placeholder={`Quick notes are fine, ${firstName}: "sent 12 reminder emails, fixed the venue sheet, waiting on Tara for the Dallas date"`} />
          <div className="row">
            <button type="button" className="dbtn primary" onClick={make} disabled={readOnly || state === 'writing'}>
              {state === 'writing' ? 'Writing…' : text ? 'Write it again' : 'Write my summary'}
            </button>
            <span className="muted small">Uses 1 of your daily CW Assistant messages.</span>
          </div>
        </div>
        <div className="hm-shift-out" aria-live="polite">
          {state === 'writing' && <p className="hm-writing"><span className="cwa-typing"><i /><i /><i /></span> Claude is writing your summary… (about a minute)</p>}
          {state !== 'writing' && !text && <p className="muted small">Your summary appears here, ready to copy into Slack.</p>}
          {state !== 'writing' && text && (
            <>
              <div className="hm-summary"><Markdown text={text} /></div>
              <div className="row"><button type="button" className="dbtn sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
            </>
          )}
        </div>
      </div>
      {error && <p className="hm-err" role="alert">{error}</p>}
    </section>
  );
}
