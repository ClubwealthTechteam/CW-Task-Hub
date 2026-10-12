'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FeedEntry } from '@/lib/integrations/zapier-feed';

type Entry = FeedEntry & { byName?: string };

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ZapierHub({ initialFeed, zaps, inboxUrl }: { initialFeed: Entry[]; zaps: string[]; inboxUrl: string | null }) {
  const [feed, setFeed] = useState(initialFeed);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  // Refresh the feed every 20 seconds while the page is open.
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch('/api/zapier/feed', { cache: 'no-store' });
      if (res.ok) setFeed((await res.json()).feed);
    }, 20_000);
    return () => clearInterval(t);
  }, []);

  const names = useMemo(() => [...new Set(feed.map((e) => e.zap))], [feed]);
  const shown = feed.filter((e) => filter === 'all' || e.zap === filter);

  async function start(name: string) {
    setConfirm(null); setMsg(`Starting ${name}…`);
    const res = await fetch('/api/integrations/zapier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, payload: {} }) });
    const b = await res.json().catch(() => ({}));
    setMsg(b.ok ? `Started ${name}.` : `Couldn’t start ${name}: ${b.error || b.status}`);
    const f = await fetch('/api/zapier/feed', { cache: 'no-store' });
    if (f.ok) setFeed((await f.json()).feed);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(inboxUrl!); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setShowUrl(true); }
  }

  return (
    <div className="ws ws-wide">
      <aside className="ws-side" aria-label="Zapier">
        <div className="ws-side-h"><b>Zapier</b><span>Updates from your Zaps</span></div>
        <nav className="ws-navs">
          <div className="ws-group">Feed</div>
          <button className="ws-nav kx-nav" aria-current={filter === 'all' ? 'page' : undefined} onClick={() => setFilter('all')}><span>All updates</span><span className="ws-count">{feed.length}</span></button>
          {names.map((n) => (
            <button key={n} className="ws-nav kx-nav" aria-current={filter === n ? 'page' : undefined} onClick={() => setFilter(n)}>
              <span>{n}</span><span className="ws-count">{feed.filter((e) => e.zap === n).length}</span>
            </button>
          ))}
        </nav>
        <div className="ws-side-f"><span className={`keap-pill${inboxUrl ? '' : ' off'}`}>{inboxUrl ? 'Inbox on' : 'Inbox not set up'}</span></div>
      </aside>

      <main className="ws-page">
        <div className="ws-page-h">
          <h1>Zapier</h1>
          <p>Zaps send updates here (new registrations, tags applied, forms submitted…), and you can start approved Zaps from the hub. The feed refreshes by itself.</p>
        </div>

        <section className="card">
          <h2>Start a Zap</h2>
          {zaps.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No Zaps can be started from the hub yet. Each one you want here is approved by adding its Catch Hook URL to <code>ZAPIER_HOOKS</code> in Vercel.</p>
          ) : (
            <>
              <p className="muted small" style={{ margin: 0 }}>A Zap can change things in other apps (Keap, Sheets, email), so each start is confirmed and logged.</p>
              <div className="row">
                {zaps.map((z) => (confirm === z ? (
                  <span key={z} className="row zap-confirm">Start <b>{z}</b>?<button className="btn danger" onClick={() => start(z)}>Start</button><button className="btn" onClick={() => setConfirm(null)}>Cancel</button></span>
                ) : <button key={z} className="btn" onClick={() => setConfirm(z)}>▶ {z}</button>))}
              </div>
              {msg && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
            </>
          )}
        </section>

        <section className="card" style={{ padding: 0, gap: 0 }}>
          <div className="spread kx-bar"><h2 style={{ fontSize: 16 }}>{filter === 'all' ? 'All updates' : filter}</h2><span className="muted small">{shown.length} shown · latest 300 kept</span></div>
          {shown.length === 0 ? <p className="empty">No updates yet. Once a Zap sends one, it shows here.</p> : (
            <ul className="zap-feed">
              {shown.map((e) => (
                <li key={e.id}>
                  <button className="zap-row" onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id}>
                    <span className={`zap-dir ${e.direction}`}>{e.direction === 'in' ? 'IN' : 'OUT'}</span>
                    <span className="zap-main"><b>{e.zap}</b>{e.event && <> · {e.event}</>}{e.summary && <small>{e.summary}</small>}{e.byName && <small>by {e.byName}</small>}</span>
                    <span className="muted small">{ago(e.at)}</span>
                  </button>
                  {openId === e.id && e.data && Object.keys(e.data).length > 0 && (
                    <dl className="kv zap-data">{Object.entries(e.data).map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>))}</dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Send updates from a Zap</h2>
          {!inboxUrl ? (
            <p className="muted small" style={{ margin: 0 }}>Add <code>ZAPIER_INBOUND_SECRET</code> (any long random text) in Vercel and redeploy to switch on the inbox.</p>
          ) : (
            <>
              <ol className="zap-steps">
                <li>In the Zap, add a step: <b>Webhooks by Zapier → POST</b>.</li>
                <li><b>URL:</b> your hub inbox URL <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy URL'}</button> <button className="linkish" onClick={() => setShowUrl((v) => !v)}>{showUrl ? 'Hide' : 'Show'}</button>{showUrl && <code className="zap-url">{inboxUrl}</code>}</li>
                <li><b>Payload type:</b> json. <b>Data:</b> <code>zap</code> = a name for the Zap, <code>event</code> = what happened, <code>summary</code> = one line to show, plus any fields you want kept (name, email, event date…).</li>
                <li>Test the step: the update appears in the feed above within 20 seconds.</li>
              </ol>
              <p className="muted small" style={{ margin: 0 }}>Keep the URL private: it contains the inbox key. The inbox only records updates; it can&apos;t change anything.</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
