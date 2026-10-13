'use client';

// The content calendar for Social Media (Jay Mar's task #9). Three tabs: the calendar (week or month),
// the daily task list, and recurring posts. (Birthday posts are handled by CW Assistant in Slack.) Upcoming Eventbrite events show on the calendar
// read-only. Everything here is planning only: nothing is posted anywhere from the hub.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLATFORMS, POST_TYPES, STATUSES, type CalendarPost, type Platform, type PostStatus, type PostType } from '@/lib/calendar-types';
import { addDays, occurrencesBetween, toDate, weekStart } from '@/lib/calendar-dates';
import { PLATFORM_META, PlatformBadges, STATUS_META, TYPE_META, TypeIcon } from './meta';
import { PostEditor, type Draft } from './PostEditor';

interface CalEvent { id: string; name: string; date: string; time?: string; city?: string; url?: string }
interface Item { post: CalendarPost; date: string; status: PostStatus }
type Tab = 'calendar' | 'daily' | 'recurring';

export const ASK_EVENT = 'cw-ask-assistant';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => toDate(d).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
const time12 = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const byTime = (a: Item, b: Item) => (a.date.localeCompare(b.date) || (a.post.time ?? '99').localeCompare(b.post.time ?? '99'));

function expand(posts: CalendarPost[], from: string, to: string): Item[] {
  const out: Item[] = [];
  for (const p of posts) {
    for (const d of occurrencesBetween(p, from, to)) out.push({ post: p, date: d, status: p.repeat === 'none' ? p.status : p.occurrences?.[d] ?? p.status });
  }
  return out.sort(byTime);
}

function repeatText(p: CalendarPost) {
  if (p.repeat === 'weekly') return `Every ${fmt(p.date, { weekday: 'long' })}`;
  if (p.repeat === 'monthly') return `Monthly on the ${fmt(p.date, { day: 'numeric' })}${['th', 'st', 'nd', 'rd'][Number(p.date.slice(-2)) % 10 > 3 || [11, 12, 13].includes(Number(p.date.slice(-2))) ? 0 : Number(p.date.slice(-2)) % 10]}`;
  if (p.repeat === 'yearly') return `Every ${fmt(p.date, { month: 'long', day: 'numeric' })}`;
  return '';
}

export function ContentCalendar({ dept, taskId, team, today, readOnly }: {
  dept: string; taskId: string; team: { id: string; name: string }[]; today: string; readOnly?: boolean;
}) {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('calendar');
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today);
  const [day, setDay] = useState(today);
  const [types, setTypes] = useState<PostType[]>([]);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [status, setStatus] = useState<PostStatus | 'all'>('all');
  const [owner, setOwner] = useState('all');
  const [showEvents, setShowEvents] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/calendar/${dept}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setPosts((body.posts as CalendarPost[]).map((p) => (TYPE_META[p.type] ? p : { ...p, type: 'other' }))); setEvents(body.events ?? []); setError(''); } else setError(body.error || 'Couldn’t load the calendar');
    setLoading(false);
  }, [dept]);
  useEffect(() => { load(); }, [load]);

  // Remember the view and tab in this browser.
  useEffect(() => {
    try {
      const v = localStorage.getItem('cw-cal-view'); if (v === 'week' || v === 'month') setView(v);
      const t = localStorage.getItem('cw-cal-tab'); if (t === 'calendar' || t === 'daily' || t === 'recurring') setTab(t);
    } catch { /* ignore */ }
  }, []);
  const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

  const shown = useMemo(() => posts.filter((p) =>
    (!types.length || types.includes(p.type))
    && (platform === 'all' || p.platforms.includes(platform))
    && (owner === 'all' || (owner === 'none' ? !p.assignee : p.assignee === owner))), [posts, types, platform, owner]);
  const withStatus = (items: Item[]) => (status === 'all' ? items : items.filter((i) => i.status === status));

  // Range on screen.
  const start = view === 'week' ? weekStart(anchor) : weekStart(`${anchor.slice(0, 7)}-01`);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];
  const items = withStatus(expand(shown, start, end));
  const eventsIn = (d: string) => (showEvents && (!types.length || types.includes('event')) ? events.filter((e) => e.date === d) : []);
  const label = view === 'week'
    ? `${fmt(start, { month: 'short', day: 'numeric' })} – ${start.slice(5, 7) === end.slice(5, 7) ? fmt(end, { day: 'numeric' }) : fmt(end, { month: 'short', day: 'numeric' })}, ${end.slice(0, 4)}`
    : fmt(`${anchor.slice(0, 7)}-01`, { month: 'long', year: 'numeric' });
  const move = (dir: number) => {
    if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else { const d = toDate(`${anchor.slice(0, 7)}-01`); d.setUTCMonth(d.getUTCMonth() + dir); setAnchor(d.toISOString().slice(0, 10)); }
  };

  async function quickStatus(it: Item, next: PostStatus) {
    const res = await fetch(`/api/calendar/${dept}/${it.post.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, date: it.post.repeat !== 'none' ? it.date : undefined }),
    });
    if (res.ok) { const { post } = await res.json(); setPosts((list) => list.map((p) => (p.id === post.id ? post : p))); }
  }

  const openNew = (date: string, preset: Partial<CalendarPost> = {}) => { if (!readOnly) setEditing({ date, ...preset }); };
  const openItem = (it: Item) => setEditing({ ...it.post, occurrence: it.post.repeat !== 'none' ? { date: it.date, status: it.status } : undefined });

  function Card({ it, compact }: { it: Item; compact?: boolean }) {
    const m = TYPE_META[it.post.type];
    return (
      <button className={`cc-card${it.status === 'posted' ? ' done' : ''}${compact ? ' compact' : ''}`} style={{ ['--t' as string]: m.color }} onClick={() => openItem(it)} title={`${m.label}: ${it.post.title}`}>
        {compact ? (
          <>
            <span className="cc-card-ic"><TypeIcon type={it.post.type} size={12} /></span>
            <span className="cc-title">{it.post.title}</span>
          </>
        ) : (
          <>
            <span className="cc-card-top">
              <span className="cc-card-ic"><TypeIcon type={it.post.type} size={13} /></span>
              <span className="cc-time">{it.post.time ? time12(it.post.time) : m.label}</span>
              {it.post.repeat !== 'none' && <span className="cc-rep" title={repeatText(it.post)}>↻</span>}
            </span>
            <span className="cc-title">{it.post.title}</span>
            <span className="cc-meta">
              <PlatformBadges platforms={it.post.platforms} />
              <span className={`cc-st ${STATUS_META[it.status].cls}`}>{STATUS_META[it.status].label}</span>
            </span>
          </>
        )}
      </button>
    );
  }

  function EventCard({ e, compact }: { e: CalEvent; compact?: boolean }) {
    return (
      <a className={`cc-card cc-event${compact ? ' compact' : ''}`} href={e.url} target="_blank" rel="noreferrer" style={{ ['--t' as string]: TYPE_META.event.color }} title={`Eventbrite: ${e.name}`}>
        {compact ? (
          <>
            <span className="cc-card-ic"><TypeIcon type="event" size={12} /></span>
            <span className="cc-title">{e.name}</span>
          </>
        ) : (
          <>
            <span className="cc-card-top">
              <span className="cc-card-ic"><TypeIcon type="event" size={13} /></span>
              <span className="cc-time">{time12(e.time) || 'Event'}</span>
            </span>
            <span className="cc-title">{e.name}</span>
            <span className="cc-meta"><span className="cc-src">Eventbrite{e.city ? ` · ${e.city}` : ''}</span></span>
          </>
        )}
      </a>
    );
  }

  // ---- Daily task list ----
  function Row({ it }: { it: Item }) {
    const m = TYPE_META[it.post.type];
    const who = team.find((t) => t.id === it.post.assignee)?.name;
    return (
      <li className={`cc-row${it.status === 'posted' ? ' done' : ''}`} style={{ ['--t' as string]: m.color }}>
        <input type="checkbox" aria-label={`Mark “${it.post.title}” as posted`} checked={it.status === 'posted'} disabled={readOnly}
          onChange={(e) => quickStatus(it, e.target.checked ? 'posted' : 'scheduled')} />
        <span className="cc-card-ic"><TypeIcon type={it.post.type} /></span>
        <span className="cc-row-main">
          <b>{it.post.title}</b>
          <span className="muted small">{[it.date !== day ? fmt(it.date, { weekday: 'short', month: 'short', day: 'numeric' }) : '', time12(it.post.time), m.label, who].filter(Boolean).join(' · ')}</span>
        </span>
        <PlatformBadges platforms={it.post.platforms} />
        <select className={`cc-st-select ${STATUS_META[it.status].cls}`} value={it.status} disabled={readOnly} aria-label="Status"
          onChange={(e) => quickStatus(it, e.target.value as PostStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <button className="linkbtn" onClick={() => openItem(it)}>{readOnly ? 'View' : 'Edit'}</button>
      </li>
    );
  }

  const dayItems = withStatus(expand(shown, day, day));
  const overdue = expand(shown, addDays(today, -30), addDays(today, -1)).filter((i) => i.status !== 'posted');
  const soon = expand(shown, addDays(day, 1), addDays(day, 3)).filter((i) => i.status === 'idea' || i.status === 'drafting');
  const soonEvents = events.filter((e) => e.date >= day && e.date <= addDays(day, 14));
  const series = shown.filter((p) => p.repeat !== 'none');

  const nextDate = (p: CalendarPost) => occurrencesBetween(p, today, addDays(today, 400))[0];

  return (
    <main className="ws-main cc" aria-label="Content calendar">
      <div className="ws-mh cc-head">
        <span className="ws-bot cc-bot"><TypeIcon type="event" size={17} /></span>
        <b>Content calendar</b>
        <div className="cc-tabs" role="tablist">
          {(['calendar', 'daily', 'recurring'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); remember('cw-cal-tab', t); }}>
              {t === 'calendar' ? 'Calendar' : t === 'daily' ? 'Daily tasks' : 'Recurring'}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {!readOnly && <button className="btn primary cc-new" onClick={() => openNew(tab === 'daily' ? day : today)}>+ New post</button>}
      </div>

      <div className="cc-filters">
        <div className="cc-legend" role="group" aria-label="Filter by type">
          {POST_TYPES.map((t) => (
            <button key={t} className={`cc-chip${types.includes(t) ? ' on' : ''}`} style={{ ['--t' as string]: TYPE_META[t].color }} aria-pressed={types.includes(t)}
              onClick={() => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
              <TypeIcon type={t} size={13} /> {TYPE_META[t].label}
            </button>
          ))}
          {types.length > 0 && <button className="linkbtn" onClick={() => setTypes([])}>Show all</button>}
        </div>
        <div className="cc-drops">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform | 'all')} aria-label="Platform">
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as PostStatus | 'all')} aria-label="Status">
            <option value="all">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="all">Everyone</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="none">Unassigned</option>
          </select>
          {events.length > 0 && <label className="cc-evt-toggle"><input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} /> Eventbrite events</label>}
        </div>
      </div>

      {error && <p className="note" role="alert" style={{ margin: '0 26px' }}>{error}</p>}

      <div className="cc-body">
        {loading ? <p className="muted small">Loading the calendar…</p> : tab === 'calendar' ? (
          <>
            <div className="cc-nav">
              <button className="linkbtn" onClick={() => move(-1)} aria-label={`Previous ${view}`}>‹</button>
              <button className="linkbtn" onClick={() => { setAnchor(today); setDay(today); }}>Today</button>
              <button className="linkbtn" onClick={() => move(1)} aria-label={`Next ${view}`}>›</button>
              <h3>{label}</h3>
              <span style={{ flex: 1 }} />
              <div className="cc-seg" role="group" aria-label="View">
                {(['week', 'month'] as const).map((v) => <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => { setView(v); remember('cw-cal-view', v); }}>{v === 'week' ? 'Week' : 'Month'}</button>)}
              </div>
            </div>

            {view === 'week' ? (
              <div className="cc-week">
                {days.map((d, i) => {
                  const its = items.filter((x) => x.date === d);
                  const evs = eventsIn(d);
                  return (
                    <section key={d} className={`cc-col${d === today ? ' today' : ''}${d < today ? ' past' : ''}`} aria-label={fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}>
                      <header>
                        <button className="cc-dayhead" onClick={() => { setDay(d); setTab('daily'); remember('cw-cal-tab', 'daily'); }} title="Open this day’s task list">
                          <span>{DOW[i]}</span><b>{fmt(d, { day: 'numeric' })}</b>
                        </button>
                        {!readOnly && <button className="cc-add" onClick={() => openNew(d)} aria-label={`Add a post on ${fmt(d, { month: 'long', day: 'numeric' })}`}>+</button>}
                      </header>
                      <div className="cc-stack">
                        {evs.map((e) => <EventCard key={`e-${e.id}`} e={e} />)}
                        {its.map((it) => <Card key={`${it.post.id}-${it.date}`} it={it} />)}
                        {!its.length && !evs.length && <span className="cc-empty">Nothing planned</span>}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="cc-month">
                {DOW.map((d) => <div key={d} className="cc-mdow">{d}</div>)}
                {days.map((d) => {
                  const its = items.filter((x) => x.date === d);
                  const evs = eventsIn(d);
                  const all = [...evs.map((e) => ({ e })), ...its.map((it) => ({ it }))];
                  const out = d.slice(0, 7) !== anchor.slice(0, 7);
                  return (
                    <div key={d} className={`cc-cell${d === today ? ' today' : ''}${out ? ' out' : ''}`}>
                      <div className="cc-cell-h">
                        <button className="cc-cell-day" onClick={() => { setDay(d); setTab('daily'); remember('cw-cal-tab', 'daily'); }} title="Open this day’s task list">{fmt(d, { day: 'numeric' })}</button>
                        {!readOnly && <button className="cc-add" onClick={() => openNew(d)} aria-label={`Add a post on ${fmt(d, { month: 'long', day: 'numeric' })}`}>+</button>}
                      </div>
                      {all.slice(0, 3).map((x) => ('e' in x ? <EventCard key={`e-${x.e.id}`} e={x.e} compact /> : <Card key={`${x.it.post.id}-${x.it.date}`} it={x.it} compact />))}
                      {all.length > 3 && <button className="cc-more" onClick={() => { setAnchor(d); setView('week'); remember('cw-cal-view', 'week'); }}>+{all.length - 3} more</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === 'daily' ? (
          <div className="cc-daily">
            <div className="cc-nav">
              <button className="linkbtn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">‹</button>
              <button className="linkbtn" onClick={() => setDay(today)}>Today</button>
              <button className="linkbtn" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">›</button>
              <h3>{day === today ? 'Today · ' : ''}{fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            </div>

            {day === today && overdue.length > 0 && (
              <section className="cc-sec warn">
                <h4>Overdue <span className="cc-count">{overdue.length}</span></h4>
                <p className="muted small">Planned for an earlier day and not marked as posted.</p>
                <ul className="cc-rows">{overdue.map((it) => <Row key={`${it.post.id}-${it.date}`} it={it} />)}</ul>
              </section>
            )}

            <section className="cc-sec">
              <h4>{day === today ? 'Post today' : 'Posts this day'} <span className="cc-count">{dayItems.length}</span></h4>
              {dayItems.length ? <ul className="cc-rows">{dayItems.map((it) => <Row key={`${it.post.id}-${it.date}`} it={it} />)}</ul>
                : <p className="muted small">Nothing planned. {!readOnly && <button className="linkbtn" onClick={() => openNew(day)}>Add a post</button>}</p>}
            </section>

            {soon.length > 0 && (
              <section className="cc-sec">
                <h4>Get ready <span className="cc-count">{soon.length}</span></h4>
                <p className="muted small">Coming up in the next 3 days and still an idea or in drafting: the graphic or caption isn’t done yet.</p>
                <ul className="cc-rows">{soon.map((it) => <Row key={`${it.post.id}-${it.date}`} it={it} />)}</ul>
              </section>
            )}

            {soonEvents.length > 0 && (
              <section className="cc-sec">
                <h4>Events to promote <span className="cc-count">{soonEvents.length}</span></h4>
                <p className="muted small">Club Wealth events in the next 2 weeks, from Eventbrite.</p>
                <ul className="cc-rows">
                  {soonEvents.map((e) => {
                    const planned = posts.some((p) => p.type === 'event' && p.title.toLowerCase().includes(e.name.toLowerCase().slice(0, 12)));
                    return (
                      <li key={e.id} className="cc-row" style={{ ['--t' as string]: TYPE_META.event.color }}>
                        <span className="cc-card-ic"><TypeIcon type="event" /></span>
                        <span className="cc-row-main">
                          <b>{e.name}</b>
                          <span className="muted small">{[fmt(e.date, { weekday: 'short', month: 'short', day: 'numeric' }), time12(e.time), e.city].filter(Boolean).join(' · ')}</span>
                        </span>
                        {planned ? <span className="cc-st st-scheduled">Promo planned</span> : !readOnly && (
                          <button className="linkbtn" onClick={() => openNew(addDays(e.date, -3) < today ? today : addDays(e.date, -3), { type: 'event', title: `Promo: ${e.name}`, platforms: ['fb-page', 'fb-group'], link: e.url })}>Plan a promo</button>
                        )}
                        {e.url && <a className="linkbtn" href={e.url} target="_blank" rel="noreferrer">Eventbrite</a>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <div className="cc-daily">
            <div className="cc-nav">
              <h3>Recurring posts</h3>
              <span style={{ flex: 1 }} />
              {!readOnly && <>
                <button className="linkbtn" onClick={() => openNew(today, { type: 'recurring', repeat: 'weekly' })}>+ Weekly post</button>
              </>}
            </div>
            {[
              { title: 'Weekly', list: series.filter((p) => p.repeat === 'weekly') },
              { title: 'Monthly and yearly', list: series.filter((p) => p.repeat !== 'weekly') },
            ].map((g) => (
              <section key={g.title} className="cc-sec">
                <h4>{g.title} <span className="cc-count">{g.list.length}</span></h4>
                {g.list.length === 0 ? <p className="muted small">None yet.</p> : (
                  <ul className="cc-rows">
                    {g.list.sort((a, b) => (nextDate(a) ?? '9').localeCompare(nextDate(b) ?? '9')).map((p) => {
                      const n = nextDate(p);
                      return (
                        <li key={p.id} className="cc-row" style={{ ['--t' as string]: TYPE_META[p.type].color }}>
                          <span className="cc-card-ic"><TypeIcon type={p.type} /></span>
                          <span className="cc-row-main">
                            <b>{p.title}</b>
                            <span className="muted small">{[repeatText(p), p.time ? time12(p.time) : '', n ? `next ${fmt(n, { month: 'short', day: 'numeric' })}` : 'ended', team.find((t) => t.id === p.assignee)?.name].filter(Boolean).join(' · ')}</span>
                          </span>
                          <PlatformBadges platforms={p.platforms} />
                          <button className="linkbtn" onClick={() => setEditing({ ...p })}>{readOnly ? 'View' : 'Edit'}</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <PostEditor
          dept={dept} taskId={taskId} team={team} draft={editing} readOnly={readOnly}
          onClose={() => setEditing(null)}
          onSaved={(post, removed) => {
            setPosts((list) => (removed ? list.filter((p) => p.id !== removed) : list.some((p) => p.id === post!.id) ? list.map((p) => (p.id === post!.id ? post! : p)) : [post!, ...list]));
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
