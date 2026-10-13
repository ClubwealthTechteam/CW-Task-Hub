'use client';

// Picks Keap tags without hunting for them: suggestions ranked by name and real use, Claude's recommendation
// (it arrives in a minute or two), and a search across every tag as a fallback.

import { useEffect, useState } from 'react';

export interface Tag { id: number; name: string; category?: string }
interface Candidate extends Tag { recent: number; total: number; sample: string[] }
interface Pick { status: 'thinking' | 'done' | 'error'; picks?: { id: number; why: string }[] }

const LABEL = { 'new-client': 'new client', member: 'Club Wealth member' } as const;

export function TagPicker({ purpose, selected, onChange }: { purpose: 'new-client' | 'member'; selected: Tag[]; onChange: (t: Tag[]) => void }) {
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Tag[] | null>(null);

  async function load() {
    const res = await fetch(`/api/keap/tags?purpose=${purpose}`, { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setError(b.error || 'Couldn’t read Keap tags'); setCands([]); return null; }
    setCands(b.candidates); setPick(b.pick);
    return b.pick as Pick | null;
  }
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => { const p = await load(); if (!stop && p?.status === 'thinking') timer = setTimeout(run, 10_000); };
    run();
    return () => { stop = true; clearTimeout(timer); };
  }, [purpose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Claude's pick is ticked for you if nothing is chosen yet.
  useEffect(() => {
    if (pick?.status === 'done' && pick.picks?.length && !selected.length && cands) {
      const chosen = pick.picks.map((p) => cands.find((c) => c.id === p.id)).filter(Boolean) as Tag[];
      if (chosen.length) onChange(chosen.map(({ id, name, category }) => ({ id, name, category })));
    }
  }, [pick, cands]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOn = (id: number) => selected.some((t) => t.id === id);
  const toggle = (t: Tag) => onChange(isOn(t.id) ? selected.filter((x) => x.id !== t.id) : [...selected, { id: t.id, name: t.name, category: t.category }].slice(0, 5));
  const why = (id: number) => pick?.picks?.find((p) => p.id === id)?.why;
  const ordered = cands ? [...cands].sort((a, b) => Number(Boolean(why(b.id))) - Number(Boolean(why(a.id)))) : [];

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const res = await fetch(`/api/keap/tags?q=${encodeURIComponent(q.trim())}`);
    const b = await res.json().catch(() => ({}));
    if (res.ok) setFound(b.tags); else setError(b.error || 'Couldn’t search');
  }

  return (
    <div className="field tp">
      <span className="cc-lab">Keap tag that marks a {LABEL[purpose]}</span>
      {selected.length > 0 && <div className="row">{selected.map((t) => <span key={t.id} className="wp-tag">{t.name}<button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t.name}`}>×</button></span>)}</div>}

      <div className="tp-box">
        <div className="tp-head">
          <b className="small">Suggested from your Keap</b>
          {pick?.status === 'thinking' && <span className="small muted tp-think"><span className="cf-spin" aria-hidden="true" /> Claude is checking these…</span>}
          {pick?.status === 'error' && <span className="small muted">Claude couldn’t check them this time; the list is ranked by name and use.</span>}
        </div>
        {cands === null ? <p className="muted small" style={{ margin: 0 }}><span className="cf-spin" aria-hidden="true" /> Reading your Keap tags…</p>
          : !ordered.length ? <p className="muted small" style={{ margin: 0 }}>No likely tags found. Search below.</p> : (
            <ul className="tp-list">
              {ordered.map((t) => (
                <li key={t.id} className={why(t.id) ? 'tp-pick' : ''}>
                  <label>
                    <input type="checkbox" checked={isOn(t.id)} onChange={() => toggle(t)} />
                    <span className="tp-main">
                      <span><b>{t.name}</b>{t.category && <span className="muted small"> · {t.category}</span>}{why(t.id) && <span className="tp-badge">✦ Claude’s pick</span>}</span>
                      <span className="small muted">{t.recent} people in the last 30 days{t.sample.length ? ` (e.g. ${t.sample.join(', ')})` : ''} · {t.total >= 3000 ? '3,000+' : t.total} in total</span>
                      {why(t.id) && <span className="small tp-why">{why(t.id)}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
      </div>

      <form className="row" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or search all Keap tags (any part of the name)" style={{ flex: 1 }} />
        <button className="btn" type="submit">Search</button>
      </form>
      {found && (found.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No tags contain “{q}”.</p> : (
        <ul className="wp-taglist">
          {found.map((t) => <li key={t.id}><label><input type="checkbox" checked={isOn(t.id)} onChange={() => toggle(t)} /> {t.name}{t.category ? <span className="muted small"> · {t.category}</span> : null}</label></li>)}
        </ul>
      ))}
      {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
