'use client';

// The Keap contact panel: search a contact, see their tags, and hand them to the task's assistant.

import { useEffect, useRef, useState } from 'react';
import { loadContact, shareContact, type ChatContact } from '@/lib/chat/contact';

interface Hit { id: number; name: string; email: string | null }

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

export function KeapContact({ taskId }: { taskId: string }) {
  const [contact, setContact] = useState<ChatContact | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => { setContact(loadContact(taskId)); }, [taskId]);

  // Search as they type (after a short pause).
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true); setError('');
      const res = await fetch(`/api/keap/contacts?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (my !== seq.current) return;
      if (res.ok) setHits(body.contacts); else { setHits(null); setError(body.error || 'Keap search failed'); }
      setBusy(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  async function pick(h: Hit) {
    setBusy(true); setError('');
    const res = await fetch(`/api/keap/contacts/${h.id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || 'Couldn’t load that contact'); return; }
    const c: ChatContact = { id: body.contact.id, name: body.contact.name, email: body.contact.email, tags: body.contact.tags };
    setContact(c); setQ(''); setHits(null);
    shareContact(taskId, c);
  }

  function clear() { setContact(null); shareContact(taskId, null); }

  if (contact) {
    return (
      <div className="kc">
        <div className="kc-person">
          <div className="ws-ava">{initials(contact.name)}</div>
          <div className="kc-who"><b>{contact.name}</b><small>{contact.email ?? 'No email on file'} · #{contact.id}</small></div>
          <button className="kc-x" onClick={clear} aria-label="Pick a different contact" title="Pick a different contact">×</button>
        </div>
        <div>
          <h5 style={{ marginBottom: 6 }}>Tags</h5>
          <div className="kc-tags">
            {contact.tags.length === 0 ? <span className="muted small">No tags</span> : contact.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
        <small className="muted">The assistant now uses this contact in its drafts.</small>
      </div>
    );
  }

  return (
    <div className="kc">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a contact by name or email" aria-label="Search Keap contacts" />
      {busy && <small className="muted">Searching Keap…</small>}
      {error && <small className="kc-err" role="alert">{error}</small>}
      {hits && !busy && (hits.length === 0
        ? <small className="muted">No contacts found.</small>
        : (
          <ul className="kc-hits">
            {hits.map((h) => (
              <li key={h.id}><button onClick={() => pick(h)}><b>{h.name}</b><small>{h.email ?? `#${h.id}`}</small></button></li>
            ))}
          </ul>
        ))}
    </div>
  );
}
