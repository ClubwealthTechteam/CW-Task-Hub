'use client';

// Choose which Keap tag marks a Club Wealth member, the field that holds their industry, and how SMS are signed.

import { useEffect, useState } from 'react';
import type { ReferralSettings } from '@/lib/referrals/store';

interface Tag { id: number; name: string; category?: string }

export function ReferralSettingsDialog({ settings, onClose, onSaved }: { settings: ReferralSettings; onClose: () => void; onSaved: (s: ReferralSettings) => void }) {
  const [tags, setTags] = useState<Tag[]>(settings.tagIds.map((id, i) => ({ id, name: settings.tagNames[i] ?? String(id) })));
  const [q, setQ] = useState('client');
  const [found, setFound] = useState<Tag[] | null>(null);
  const [fields, setFields] = useState<{ id: number; label: string }[]>([]);
  const [industry, setIndustry] = useState(settings.industryField ? String(settings.industryField) : '');
  const [sender, setSender] = useState(settings.sender);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(term = q) {
    if (!term.trim()) return;
    setError('');
    const res = await fetch(`/api/referrals/settings?q=${encodeURIComponent(term.trim())}`);
    const b = await res.json().catch(() => ({}));
    if (res.ok) setFound(b.tags); else setError(b.error || 'Couldn’t search Keap tags');
  }
  useEffect(() => {
    search('client');
    fetch('/api/referrals/settings?fields=1').then((r) => r.json()).then((b) => setFields(b.fields ?? [])).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (t: Tag) => setTags((cur) => (cur.some((x) => x.id === t.id) ? cur.filter((x) => x.id !== t.id) : [...cur, t].slice(0, 5)));
  async function save() {
    setBusy(true);
    const res = await fetch('/api/referrals/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, industryField: industry ? Number(industry) : null, industryLabel: fields.find((f) => String(f.id) === industry)?.label, sender }),
    });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onSaved(b.settings); else setError(b.error || 'Couldn’t save');
  }

  return (
    <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="rf-set-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-editor">
        <div className="spread"><h3 id="rf-set-title">Referral settings</h3><button className="cc-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="field">
          <span className="cc-lab">Keap tag that marks a Club Wealth member</span>
          {tags.length > 0 && <div className="row">{tags.map((t) => <span key={t.id} className="wp-tag">{t.name}<button onClick={() => toggle(t)} aria-label={`Remove ${t.name}`}>×</button></span>)}</div>}
          <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Keap tags, e.g. Active Client" style={{ flex: 1 }} />
            <button className="btn" type="submit">Search</button>
          </form>
          {found && (found.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No tags match. Try “member” or “active”.</p> : (
            <ul className="wp-taglist">
              {found.map((t) => <li key={t.id}><label><input type="checkbox" checked={tags.some((x) => x.id === t.id)} onChange={() => toggle(t)} /> {t.name}{t.category ? <span className="muted small"> · {t.category}</span> : null}</label></li>)}
            </ul>
          ))}
        </div>
        <div className="cc-grid3">
          <label className="field" style={{ gridColumn: 'span 2' }}><span className="cc-lab">Member’s industry comes from (optional)</span>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">Not in Keap: I’ll add services in the Members tab</option>
              {fields.map((f) => <option key={f.id} value={f.id}>Custom field: {f.label}</option>)}
            </select>
          </label>
          <label className="field"><span className="cc-lab">Sign SMS as</span><input value={sender} onChange={(e) => setSender(e.target.value)} /></label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>The hub only reads Keap. Nothing in Keap changes.</p>
        {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="cc-actions">
          <button className="btn primary" onClick={save} disabled={busy || !tags.length}>Save</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
