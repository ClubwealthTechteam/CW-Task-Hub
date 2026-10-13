'use client';

// Choose which Keap tag marks a new client, how far back to look, and where the coach's name comes from.

import { useEffect, useState } from 'react';
import type { WelcomeSettings } from '@/lib/welcome/store';

import { TagPicker, type Tag } from '@/components/keap/TagPicker';

export function WelcomeSettingsDialog({ settings, onClose, onSaved }: { settings: WelcomeSettings; onClose: () => void; onSaved: (s: WelcomeSettings) => void }) {
  const [tags, setTags] = useState<Tag[]>(settings.tagIds.map((id, i) => ({ id, name: settings.tagNames[i] ?? String(id) })));
  const [days, setDays] = useState(settings.days);
  const [coach, setCoach] = useState<string>(settings.coachField);
  const [auto, setAuto] = useState(settings.auto);
  const [find, setFind] = useState<'claude' | 'tag'>(settings.find ?? 'claude');
  const [perDay, setPerDay] = useState(settings.perDay);
  const [time, setTime] = useState(settings.time);
  const [fields, setFields] = useState<{ id: number; label: string }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/welcome/settings?fields=1').then((r) => r.json()).then((b) => setFields(b.fields ?? [])).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    const res = await fetch('/api/welcome/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ find, tags, days, auto, perDay, time, coachField: coach, coachFieldLabel: fields.find((f) => `custom:${f.id}` === coach)?.label }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onSaved(body.settings); else setError(body.error || 'Couldn’t save');
  }


  return (
    <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="wp-set-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-editor">
        <div className="spread"><h3 id="wp-set-title">Welcome posts settings</h3><button className="cc-x" onClick={onClose} aria-label="Close">×</button></div>

        <div className="field">
          <span className="cc-lab">How new clients are found</span>
          <label className="wp-check"><input type="radio" name="wp-find" checked={find === 'claude'} onChange={() => setFind('claude')} /> <b>Claude finds them</b> <span className="muted small">(recommended)</span></label>
          <span className="muted small" style={{ marginLeft: 24 }}>Claude reads Keap’s recent paid orders and client tags and decides who just became a client (not leads, event tickets or renewals). It looks again every 12 hours.</span>
          <label className="wp-check"><input type="radio" name="wp-find" checked={find === 'tag'} onChange={() => setFind('tag')} /> Everyone who gets a Keap tag</label>
        </div>
        {find === 'tag' && <TagPicker purpose="new-client" selected={tags} onChange={setTags} />}

        <div className="cc-grid3">
          <label className="field"><span className="cc-lab">Look back</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          </label>
          <label className="field" style={{ gridColumn: 'span 2' }}><span className="cc-lab">Coach’s name comes from</span>
            <select value={coach} onChange={(e) => setCoach(e.target.value)}>
              <option value="owner">The contact’s owner in Keap</option>
              {fields.map((f) => <option key={f.id} value={`custom:${f.id}`}>Custom field: {f.label}</option>)}
            </select>
          </label>
        </div>

        <div className="field">
          <label className="wp-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> <b>Prepare posts automatically</b></label>
          <span className="muted small">For each new client: write the Page and Group captions, put the post on the content calendar, and make the welcome graphic once there’s a photo (or the no-photo version). Posting stays with you.</span>
          {auto && (
            <div className="cc-grid3">
              <label className="field"><span className="cc-lab">Welcome posts per weekday</span>
                <select value={perDay} onChange={(e) => setPerDay(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              <label className="field"><span className="cc-lab">Post time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            </div>
          )}
        </div>

        <p className="muted small" style={{ margin: 0 }}>The hub only reads Keap. Changing these settings doesn’t change anything in Keap.</p>
        {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="cc-actions">
          <button className="btn primary" onClick={save} disabled={busy || (find === 'tag' && !tags.length)}>Save</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
