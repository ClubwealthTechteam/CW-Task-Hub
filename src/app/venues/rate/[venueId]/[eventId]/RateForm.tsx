'use client';

// Four areas (Good / Okay / Bad), an overall verdict, an optional note, Send. Big tap targets for phones.

import { useState } from 'react';

const TONE: Record<string, string> = { Good: 'ok', Okay: 'warn', Bad: 'bad', 'All good': 'ok', 'Not recommended next time': 'warn', 'Do not come back': 'bad' };

export function RateForm({ venueId, eventId, firstName, areas, scores, verdicts, initial }: {
  venueId: string; eventId: string; firstName: string;
  areas: { id: string; label: string }[]; scores: string[]; verdicts: string[];
  initial?: { scores: Record<string, string>; verdict: string; note: string };
}) {
  const [picked, setPicked] = useState<Record<string, string>>(initial?.scores ?? {});
  const [verdict, setVerdict] = useState(initial?.verdict ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const complete = areas.every((a) => picked[a.id]) && Boolean(verdict);

  const send = async () => {
    setSending(true); setMsg('');
    const r = await fetch('/api/venues/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId, eventId, scores: picked, verdict, note }) });
    const d = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) { setMsg(d.error || 'Could not send. Try again.'); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="vr-done" role="status">
        <b>Thanks, {firstName}!</b>
        <p>Your rating is saved on the venue for the Events team.</p>
        <button className="vr-link" onClick={() => setSent(false)}>Change my rating</button>
      </div>
    );
  }

  return (
    <div className="vr-form">
      {initial && <p className="vr-note-info">You rated this already. Sending again replaces your rating.</p>}
      {areas.map((a) => (
        <fieldset key={a.id} className="vr-group">
          <legend>{a.label}</legend>
          <div className="vr-opts three">
            {scores.map((s) => (
              <button key={s} type="button" className={`tone-${TONE[s]}${picked[a.id] === s ? ' is-on' : ''}`} aria-pressed={picked[a.id] === s}
                onClick={() => setPicked((p) => ({ ...p, [a.id]: s }))}>{s}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="vr-group">
        <legend>Overall</legend>
        <div className="vr-opts">
          {verdicts.map((v) => (
            <button key={v} type="button" className={`tone-${TONE[v]}${verdict === v ? ' is-on' : ''}`} aria-pressed={verdict === v} onClick={() => setVerdict(v)}>{v}</button>
          ))}
        </div>
      </fieldset>
      <label className="vr-group vr-text">
        <span>Note <i>(optional)</i></span>
        <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the Events team should know?" />
      </label>
      {msg && <p className="vr-err" role="alert">{msg}</p>}
      <button className="vr-send" onClick={send} disabled={!complete || sending}>{sending ? 'Sending…' : 'Send'}</button>
      {!complete && <p className="vr-hint">Pick one for each area and an overall verdict.</p>}
    </div>
  );
}
