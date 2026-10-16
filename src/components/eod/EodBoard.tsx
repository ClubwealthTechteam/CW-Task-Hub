'use client';

// EOD reports. Team members fill theirs in through the day (saved as a draft as they type) and submit it at
// the end of the shift. Super admins see every submitted report as it comes in, and can ask the CW Assistant
// which of the tasks could be automated.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PROMPT_MAX, automationPrompt, blankEntry, longDate, minutes, pacificDate, parsePasted, reportText, slot,
  type EodEntry, type EodReport,
} from '@/lib/eod/report';

export interface EodPerson { id: string; name: string; dept: string }

const firstName = (n: string) => n.split(/\s+/)[0];
const atTime = (at?: number) => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT' : '');
const hours = (r: EodReport) => { const m = r.entries.reduce((s, e) => s + minutes(e), 0); return m ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : ''; };
const addMin = (t: string, n: number) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return '';
  const v = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + n);
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
const askAssistant = (text: string) => window.dispatchEvent(new CustomEvent('cwa:new', { detail: { text } }));

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** The report as a table (read view, used by both sides). */
function ReportView({ r }: { r: EodReport }) {
  return (
    <div className="eod-view">
      <div className="eod-tablewrap">
        <table className="eod-table">
          <thead><tr><th>Time</th><th>Task</th><th>Notes</th></tr></thead>
          <tbody>
            {r.entries.map((e) => (
              <tr key={e.id}>
                <td className="eod-time">{slot(e) || '—'}</td>
                <td><b>{e.task}</b>{e.daily && <span className="pill gold eod-daily">Daily</span>}</td>
                <td className="eod-notes">{e.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[['Highlights', r.highlights], ['Blockers / needs help', r.blockers], ['Plan for tomorrow', r.tomorrow]].filter(([, v]) => v.trim()).map(([k, v]) => (
        <div key={k} className="eod-extra"><span className="eyebrow">{k}</span><p>{v}</p></div>
      ))}
    </div>
  );
}

// ───────────── Team member: write today's report ─────────────

function Writer({ readOnly }: { readOnly: boolean }) {
  const [date, setDate] = useState(pacificDate());
  const [report, setReport] = useState<EodReport | null>(null);
  const [recent, setRecent] = useState<EodReport[]>([]);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [how, setHow] = useState<'paste' | 'type'>('paste');
  const [pasted, setPasted] = useState('');
  const [day, setDay] = useState<number | undefined>(undefined);
  const dirty = useRef(false);

  const load = useCallback(async (d: string) => {
    setError(''); setReport(null); dirty.current = false;
    const res = await fetch(`/api/eod?date=${d}`, { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return setError(b.error || 'Couldn’t load your report');
    const r: EodReport = b.report;
    setReport(r.entries.length ? r : { ...r, entries: [blankEntry('05:30', '06:00')] });
    // An empty day starts on "Paste my EOD sheet"; a day already filled in opens its rows.
    setHow(r.entries.length ? 'type' : 'paste'); setPasted(''); setDay(undefined);
    setRecent(b.recent ?? []);
  }, []);
  useEffect(() => { load(date); }, [date, load]);

  const save = useCallback(async (r: EodReport, submit = false) => {
    setSaving('saving');
    const res = await fetch('/api/eod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, submit }) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) { setSaving('idle'); setError(b.error || 'Couldn’t save'); return null; }
    dirty.current = false;
    setSaving('saved'); setError('');
    setRecent((list) => [b.report, ...list.filter((x) => x.id !== b.report.id)].sort((x, y) => y.date.localeCompare(x.date)));
    return b.report as EodReport;
  }, []);

  // Drafts save themselves a moment after typing stops. A submitted report only changes on "Save changes".
  useEffect(() => {
    if (!report || readOnly || !dirty.current || report.status === 'submitted') return;
    const t = setTimeout(() => { save(report); }, 1200);
    return () => clearTimeout(t);
  }, [report, readOnly, save]);

  if (error && !report) return <p className="note" role="alert">{error}</p>;
  if (!report) return <p className="muted small">Loading your report…</p>;

  const change = (patch: Partial<EodReport>) => { dirty.current = true; setSaving('idle'); setReport({ ...report, ...patch }); };
  const setEntry = (id: string, patch: Partial<EodEntry>) => change({ entries: report.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addRow = () => {
    const last = report.entries.at(-1);
    const start = last?.end || last?.start || '';
    change({ entries: [...report.entries, blankEntry(start, start ? addMin(start, 30) : '')] });
  };
  const lastDaily = recent.find((r) => r.date < date && r.entries.some((e) => e.daily));
  const copyDaily = () => {
    if (!lastDaily) return;
    const kept = report.entries.filter((e) => e.task || e.notes.trim());
    change({ entries: [...kept, ...lastDaily.entries.filter((e) => e.daily).map((e) => ({ ...blankEntry(e.start, e.end), task: e.task, daily: true }))] });
  };
  async function submit() {
    if (!report) return;
    setBusy(true);
    const r = await save(report, true);
    setBusy(false);
    if (r) setReport(r);
  }

  const parsed = pasted.trim() ? parsePasted(pasted, day) : null;
  const hasRows = report.entries.some((e) => e.task.trim() || e.notes.trim());
  // Tasks they ticked as Daily before stay ticked when the same task comes in from the sheet.
  const knownDaily = new Set(recent.flatMap((r) => r.entries.filter((e) => e.daily).map((e) => e.task.trim().toLowerCase())));
  const usePasted = (mode: 'replace' | 'add') => {
    if (!parsed?.rows.length) return;
    const rows = parsed.rows.map((p) => ({ ...blankEntry(p.start, p.end), task: p.task, notes: p.notes, daily: knownDaily.has(p.task.toLowerCase()) }));
    const kept = mode === 'add' ? report.entries.filter((e) => e.task.trim() || e.notes.trim()) : [];
    change({ entries: [...kept, ...rows].sort((a, b) => (a.start || '99').localeCompare(b.start || '99')) });
    setPasted(''); setHow('type');
  };

  const submitted = report.status === 'submitted';
  const filled = report.entries.filter((e) => e.task.trim());
  return (
    <>
      <section className="card eod-card" aria-label="My EOD report">
        <div className="eod-head">
          <div>
            <h2>{date === pacificDate() ? 'Today’s EOD report' : `EOD report · ${longDate(date)}`}</h2>
            <p className="muted small">
              {submitted ? <>Submitted {atTime(report.submittedAt)}{report.edited ? ' · edited' : ''}. Changes need <b>Save changes</b>.</>
                : 'Fill it in through your shift. It saves as you type, and the admins only see it once you submit.'}
            </p>
          </div>
          <div className="row">
            <label className="field eod-date"><span>Date</span>
              <input type="date" value={date} max={pacificDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
            <span className={`pill${submitted ? ' live' : ''}`}>{submitted ? 'Submitted' : 'Draft'}</span>
          </div>
        </div>

        {!readOnly && (
          <div className="eod-how" role="tablist" aria-label="How to fill in your report">
            <button role="tab" aria-selected={how === 'paste'} className={`chip-btn${how === 'paste' ? ' on' : ''}`} onClick={() => setHow('paste')}>Paste my EOD sheet</button>
            <button role="tab" aria-selected={how === 'type'} className={`chip-btn${how === 'type' ? ' on' : ''}`} onClick={() => setHow('type')}>Type it in</button>
          </div>
        )}

        {!readOnly && how === 'paste' && (
          <div className="eod-paste">
            <p className="muted small" style={{ margin: 0 }}>
              In your EOD sheet, select the <b>Time</b> column and today’s column (or the whole week), copy, and paste below. The emailed PDS layout works too.
            </p>
            <textarea aria-label="Paste your EOD sheet" rows={7} value={pasted} onChange={(e) => { setPasted(e.target.value); setDay(undefined); }}
              placeholder={'6:30 AM\tPrepared shift log, checked Hot/Urgent list…\n7:00 AM\tConnected Keap to the Monitoring dashboard…\n7:30 AM\tDAILY HUDDLE'} />
            {parsed && (
              <div className="row">
                {parsed.columns.length > 1 && (
                  <label className="field eod-date"><span>Which day?</span>
                    <select value={parsed.column} onChange={(e) => setDay(Number(e.target.value))}>
                      {parsed.columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
                    </select>
                  </label>
                )}
                <span className="muted small" aria-live="polite">
                  {parsed.rows.length ? `Found ${parsed.rows.length} task${parsed.rows.length === 1 ? '' : 's'}${parsed.rows[0].start ? ` · ${slot({ ...blankEntry(parsed.rows[0].start), end: parsed.rows.at(-1)!.end })}` : ''}` : 'No tasks found. Make sure the Time column is included.'}
                </span>
              </div>
            )}
            {parsed && parsed.rows.length > 0 && (
              <div className="row">
                <button className="btn primary" onClick={() => usePasted('replace')}>{hasRows ? 'Replace my rows with these' : `Use these ${parsed.rows.length} tasks`}</button>
                {hasRows && <button className="btn" onClick={() => usePasted('add')}>Add to my rows</button>}
                <span className="muted small">You can check them, tick Daily and edit before you submit.</span>
              </div>
            )}
          </div>
        )}

        {(readOnly || how === 'type') && (<>
        <div className="eod-tablewrap">
          <table className="eod-table eod-edit">
            <thead><tr><th>Start</th><th>End</th><th>Task</th><th>Notes and numbers</th><th title="I do this every day">Daily</th><th aria-label="Remove" /></tr></thead>
            <tbody>
              {report.entries.map((e, i) => (
                <tr key={e.id}>
                  <td><input type="time" step={900} value={e.start} aria-label={`Row ${i + 1} start`} disabled={readOnly} onChange={(ev) => setEntry(e.id, { start: ev.target.value })} /></td>
                  <td><input type="time" step={900} value={e.end} aria-label={`Row ${i + 1} end`} disabled={readOnly} onChange={(ev) => setEntry(e.id, { end: ev.target.value })} /></td>
                  <td><textarea value={e.task} maxLength={300} rows={Math.min(6, Math.max(1, Math.ceil(e.task.length / 60)))} placeholder="e.g. Daily Huddle Report pulls" aria-label={`Row ${i + 1} task`} disabled={readOnly} onChange={(ev) => setEntry(e.id, { task: ev.target.value.replace(/\n/g, ' ') })} /></td>
                  <td><textarea value={e.notes} rows={Math.min(6, Math.max(1, e.notes.split('\n').length))} placeholder="What you did, counts, who you helped" aria-label={`Row ${i + 1} notes`} disabled={readOnly} onChange={(ev) => setEntry(e.id, { notes: ev.target.value })} /></td>
                  <td className="eod-c"><input type="checkbox" checked={e.daily} aria-label={`Row ${i + 1}: I do this every day`} disabled={readOnly} onChange={(ev) => setEntry(e.id, { daily: ev.target.checked })} /></td>
                  <td className="eod-c">{!readOnly && <button className="linkbtn" aria-label={`Remove row ${i + 1}`} onClick={() => change({ entries: report.entries.filter((x) => x.id !== e.id) })}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="row">
            <button className="btn" onClick={addRow}>+ Add task</button>
            {lastDaily && <button className="btn" onClick={copyDaily}>Add my daily tasks from {longDate(lastDaily.date)}</button>}
            <span className="muted small">Tick <b>Daily</b> on tasks you do every day; those are the ones we look at automating first.</span>
          </div>
        )}
        </>)}

        <div className="eod-extras">
          <label className="field"><span>Highlights</span><textarea rows={2} value={report.highlights} disabled={readOnly} placeholder="Wins and numbers worth seeing first" onChange={(e) => change({ highlights: e.target.value })} /></label>
          <label className="field"><span>Blockers / needs help</span><textarea rows={2} value={report.blockers} disabled={readOnly} placeholder="Anything stuck or waiting on someone" onChange={(e) => change({ blockers: e.target.value })} /></label>
          <label className="field"><span>Plan for tomorrow</span><textarea rows={2} value={report.tomorrow} disabled={readOnly} onChange={(e) => change({ tomorrow: e.target.value })} /></label>
        </div>

        {error && <p className="note" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!readOnly && (
          <div className="row">
            {submitted
              ? <button className="btn primary" disabled={busy || !dirty.current} onClick={submit}>{busy ? 'Saving…' : 'Save changes'}</button>
              : <button className="btn primary" disabled={busy || !filled.length} onClick={submit}>{busy ? 'Submitting…' : 'Submit EOD report'}</button>}
            <span className="muted small" aria-live="polite">
              {saving === 'saving' ? 'Saving…' : saving === 'saved' ? (submitted ? 'Saved' : 'Draft saved') : ''}
              {filled.length ? ` · ${filled.length} task${filled.length === 1 ? '' : 's'}${hours(report) ? ` · ${hours(report)}` : ''}` : ''}
            </span>
          </div>
        )}
        {readOnly && <p className="muted small">You’re previewing this view, so it’s read-only.</p>}
      </section>

      {recent.length > 0 && (
        <section className="card" aria-label="My past reports">
          <h3>My reports</h3>
          <div className="row">
            {recent.slice(0, 14).map((r) => (
              <button key={r.id} className={`chip-btn${r.date === date ? ' on' : ''}`} aria-pressed={r.date === date} onClick={() => setDate(r.date)}>
                {longDate(r.date).replace(/, \d{4}$/, '')}{r.status === 'draft' ? ' · draft' : ''}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ───────────── Super admins: live feed ─────────────

function Feed({ people }: { people: EodPerson[] }) {
  const [feed, setFeed] = useState<EodReport[] | null>(null);
  const [who, setWho] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const name = useCallback((uid: string) => people.find((p) => p.id === uid)?.name ?? uid, [people]);

  const load = useCallback(async () => {
    const res = await fetch('/api/eod?feed=1', { cache: 'no-store' });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return setError(b.error || 'Couldn’t load reports');
    setFeed(b.feed ?? []); setError('');
  }, []);
  // Live: new submissions show up without a reload.
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { const h = decodeURIComponent(location.hash.slice(1)); if (h) setOpen(h); }, []);

  const today = pacificDate();
  const shown = useMemo(() => (feed ?? []).filter((r) => who === 'all' || r.uid === who), [feed, who]);
  const inToday = new Set((feed ?? []).filter((r) => r.date === today).map((r) => r.uid));
  // Tasks people mark as daily over the last two weeks: the automation shortlist.
  const dailies = useMemo(() => {
    const since = pacificDate(Date.now() - 14 * 86_400_000);
    const byPerson = new Map<string, Map<string, number>>();
    for (const r of feed ?? []) {
      if (r.date < since || (who !== 'all' && r.uid !== who)) continue;
      const m = byPerson.get(r.uid) ?? new Map<string, number>();
      for (const e of r.entries) if (e.daily && e.task.trim()) { const k = e.task.trim(); m.set(k, (m.get(k) ?? 0) + 1); }
      if (m.size) byPerson.set(r.uid, m);
    }
    return [...byPerson].map(([uid, m]) => ({ uid, tasks: [...m].sort((a, b) => b[1] - a[1]) }));
  }, [feed, who]);

  if (error && !feed) return <p className="note" role="alert">{error}</p>;
  if (!feed) return <p className="muted small">Loading reports…</p>;

  const domId = (r: EodReport) => r.id.replace(':', '-');
  return (
    <>
      <section className="card" aria-label="Who has submitted today">
        <div className="eod-head">
          <div>
            <h2>Today · {longDate(today)}</h2>
            <p className="muted small">Reports appear here the moment someone submits. This page checks for new ones every 30 seconds.</p>
          </div>
        </div>
        <div className="row">
          {people.map((p) => (
            <span key={p.id} className={`pill${inToday.has(p.id) ? ' live' : ''}`} title={inToday.has(p.id) ? 'Submitted today' : 'Not submitted yet'}>
              {inToday.has(p.id) ? '✓' : '·'} {firstName(p.name)}
            </span>
          ))}
        </div>
      </section>

      <section className="card" aria-label="Reports">
        <div className="eod-head">
          <h2>Reports</h2>
          <label className="field eod-date"><span>Person</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        {!shown.length ? <p className="muted small">No submitted reports yet.</p> : (
          <ul className="wp-list">
            {shown.map((r) => {
              const isOpen = open === domId(r);
              const n = name(r.uid);
              return (
                <li key={r.id} id={domId(r)} className={`wp-card${isOpen ? ' open' : ''}`}>
                  <button className="wp-row" onClick={() => setOpen(isOpen ? null : domId(r))} aria-expanded={isOpen}>
                    <span className="wp-ava">{n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                    <span className="wp-who"><b>{n} · {longDate(r.date)}</b>
                      <span className="muted small">{r.entries.length} tasks{hours(r) ? ` · ${hours(r)}` : ''}{r.entries.some((e) => e.daily) ? ` · ${r.entries.filter((e) => e.daily).length} daily` : ''} · submitted {atTime(r.submittedAt)}{r.edited ? ' · edited' : ''}</span>
                    </span>
                    {r.blockers.trim() && <span className="pill req">Needs help</span>}
                  </button>
                  {isOpen && (
                    <div className="wp-steps">
                      <ReportView r={r} />
                      <div className="row">
                        <button className="btn primary" onClick={() => askAssistant(automationPrompt(r, n))}>Find automation ideas</button>
                        <button className="btn" onClick={async () => { if (await copyText(reportText(r, n))) { setCopied(r.id); setTimeout(() => setCopied(''), 1500); } }}>{copied === r.id ? 'Copied ✓' : 'Copy report'}</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-label="Daily tasks">
        <h2>Daily tasks · last 14 days</h2>
        <p className="muted small">Tasks people tick as <b>Daily</b>, and how many reports they appear in. These are the first places to look for automation.</p>
        {!dailies.length ? <p className="muted small">Nothing marked daily yet.</p> : (
          <div className="eod-dailies">
            {dailies.map(({ uid, tasks }) => (
              <div key={uid} className="eod-dgroup">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>{name(uid)}</b>
                  <button className="linkbtn" onClick={() => askAssistant(`These are tasks ${name(uid)} marks as done every day in their EOD reports (with how many of the last 14 days' reports they appear in). Which could we automate or speed up with Claude, Zapier, Keap or Google Sheets? Rank by impact, give a rough how-to and the time saved per day, and list questions to ask ${firstName(name(uid))} first.\n\n${tasks.map(([t, c]) => `- ${t} (${c} reports)`).join('\n')}`.slice(0, PROMPT_MAX))}>Ask the assistant</button>
                </div>
                <ul>{tasks.map(([t, c]) => <li key={t}>{t} <span className="muted small">· {c}</span></li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Team members get their own report; super admins get theirs plus the team feed, as two tabs. */
export function EodBoard({ team, people, readOnly }: { team: boolean; people: EodPerson[]; readOnly: boolean }) {
  const [tab, setTab] = useState<'team' | 'mine'>('team');
  if (!team) return <Writer readOnly={readOnly} />;
  return (
    <>
      <div className="eod-how eod-tabs" role="tablist" aria-label="EOD reports">
        <button role="tab" aria-selected={tab === 'team'} className={`chip-btn${tab === 'team' ? ' on' : ''}`} onClick={() => setTab('team')}>Team reports</button>
        <button role="tab" aria-selected={tab === 'mine'} className={`chip-btn${tab === 'mine' ? ' on' : ''}`} onClick={() => setTab('mine')}>My EOD report</button>
      </div>
      {tab === 'team' ? <Feed people={people} /> : <Writer readOnly={readOnly} />}
    </>
  );
}
