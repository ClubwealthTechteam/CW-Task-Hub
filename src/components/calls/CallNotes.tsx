'use client';

// Call notes (Client Care): pick the call type and outcome, get the exact Keap note. Calling the same client
// again adds a dated line, so "Copy full note" always gives the whole history for the one Keap task.

import { useEffect, useMemo, useState } from 'react';
import { CALL_TYPES, OUTCOMES, fullNote, noteLine, outcomeOf, type CallClient, type CallType } from '@/lib/calls/notes';

const ASK_EVENT = 'cw-ask-assistant';
const isToday = (at: number) => new Date(at).toDateString() === new Date().toDateString();

export function CallNotes({ taskId, readOnly }: { taskId: string; readOnly?: boolean }) {
  const [clients, setClients] = useState<CallClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<CallType>('onboarding');
  const [outcome, setOutcome] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch('/api/call-notes', { cache: 'no-store' }).then((r) => r.json()).then((b) => setClients(b.clients ?? [])).catch(() => setError('Couldn’t load call notes')).finally(() => setLoading(false));
  }, []);

  const chosen = outcomeOf(type, outcome);
  const preview = chosen ? noteLine({ at: Date.now(), type, outcome, details, by: '' }) : '';
  const today = useMemo(() => clients.filter((c) => isToday(c.entries.at(-1)!.at)), [clients]);
  const earlier = useMemo(() => clients.filter((c) => !isToday(c.entries.at(-1)!.at)), [clients]);

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { setError('Couldn’t copy. Select the text and copy it instead.'); }
  }
  const upsert = (c: CallClient | null, key: string) => setClients((list) => (c ? [c, ...list.filter((x) => x.key !== c.key)] : list.filter((x) => x.key !== key)));

  async function add() {
    setBusy(true); setError('');
    const res = await fetch('/api/call-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, outcome, details }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(b.error || 'Couldn’t save');
    upsert(b.client, b.client.key);
    setOpen(b.client.key);
    // A first call: the line is the whole note. A repeat call: copy the full note to paste over the old one.
    copy(b.client.key, b.client.entries.length > 1 ? fullNote(b.client) : noteLine(b.client.entries.at(-1)));
    setName(''); setOutcome(''); setDetails('');
  }
  async function undo(c: CallClient, at: number) {
    const res = await fetch(`/api/call-notes?client=${encodeURIComponent(c.key)}&at=${at}`, { method: 'DELETE' });
    if (res.ok) upsert((await res.json()).client, c.key);
  }
  const ask = (text: string) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { taskId, text } }));

  const card = (c: CallClient) => {
    const last = c.entries.at(-1)!;
    const isOpen = open === c.key;
    return (
      <li key={c.key} className={`wp-card${isOpen ? ' open' : ''}`}>
        <button className="wp-row" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}>
          <span className="wp-ava">{c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          <span className="wp-who"><b>{c.name}</b><span className="muted small">{noteLine(last)}</span></span>
          <span className="wp-st">{c.entries.length} call{c.entries.length === 1 ? '' : 's'}</span>
        </button>
        {isOpen && (
          <div className="wp-steps">
            <pre className="cn-note">{fullNote(c)}</pre>
            <div className="row">
              <button className="btn primary" onClick={() => copy(c.key, fullNote(c))}>{copied === c.key ? 'Copied ✓' : 'Copy full note'}</button>
              <button className="btn" onClick={() => copy(`${c.key}-last`, noteLine(last))}>{copied === `${c.key}-last` ? 'Copied ✓' : 'Copy latest line'}</button>
              <button className="btn" onClick={() => ask(`Write a follow-up text for ${c.name} based on these call notes:\n${fullNote(c)}`)}>Draft a follow-up text</button>
              {!readOnly && <button className="linkbtn" onClick={() => undo(c, last.at)}>Undo last call</button>}
            </div>
            <p className="muted small" style={{ margin: 0 }}>Paste the full note into the client’s existing Keap task so all updates stay in one place.</p>
          </div>
        )}
      </li>
    );
  };

  return (
    <main className="ws-main wp" aria-label="Call notes">
      <div className="ws-mh">
        <span className="ws-bot wp-bot" aria-hidden="true">📞</span>
        <b>Call notes</b>
        <span className="muted small wp-from">Pick the outcome, paste the note into Keap · the hub doesn’t change Keap</span>
      </div>
      <div className="wp-body">
        {!readOnly && (
          <section className="wp-card open cn-form" aria-label="Log a call">
            <div className="wp-steps" style={{ borderTop: 0 }}>
              <div className="cn-top">
                <label className="field"><span>Client</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client’s full name" list="cn-names" autoComplete="off" />
                  <datalist id="cn-names">{clients.map((c) => <option key={c.key} value={c.name} />)}</datalist>
                </label>
                <div className="field"><span>Call</span>
                  <div className="row" role="group" aria-label="Call type">
                    {CALL_TYPES.map((t) => <button key={t.id} className={`chip-btn${type === t.id ? ' on' : ''}`} aria-pressed={type === t.id} onClick={() => { setType(t.id); setOutcome(''); }}>{t.label}</button>)}
                  </div>
                </div>
              </div>
              <div className="field"><span>Outcome</span>
                <div className="row cn-outcomes" role="group" aria-label="Outcome">
                  {OUTCOMES[type].map((o) => <button key={o.id} className={`chip-btn${outcome === o.id ? ' on' : ''}`} aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}>{o.label}</button>)}
                </div>
              </div>
              {chosen && (
                <label className="field"><span>{chosen.needs ?? 'Anything to add (optional)'}</span>
                  <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={chosen.needs ? '' : 'e.g. prefers texts after 5pm'} />
                </label>
              )}
              {preview && <pre className="cn-note">{preview}</pre>}
              {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
              <div className="row">
                <button className="btn primary" onClick={add} disabled={busy || !name.trim() || !chosen || Boolean(chosen.needs && !details.trim())}>{busy ? 'Saving…' : 'Save & copy note'}</button>
                <span className="muted small">A repeat call copies the full note with every update.</span>
              </div>
            </div>
          </section>
        )}
        {loading ? <p className="muted small">Loading call notes…</p> : !clients.length ? <p className="muted small">No calls logged yet.</p> : (
          <>
            {today.length > 0 && <section className="wp-group"><h4>Today <span className="wp-n">{today.length}</span></h4><ul className="wp-list">{today.map(card)}</ul></section>}
            {earlier.length > 0 && <section className="wp-group"><h4>Earlier <span className="wp-n">{earlier.length}</span></h4><ul className="wp-list">{earlier.map(card)}</ul></section>}
          </>
        )}
      </div>
    </main>
  );
}
