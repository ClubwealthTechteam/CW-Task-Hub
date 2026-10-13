'use client';

// Assistant activity: questions asked per day (last 7 days) or per week (last 4 weeks). Hover or focus a bar
// for the details. Plain HTML/CSS bars, no chart library.

import { useMemo, useState } from 'react';
import type { DayCount } from '@/lib/dashboard';

type Range = 'week' | 'month';
const label = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

export function ActivityChart({ days }: { days: DayCount[] }) {
  const [range, setRange] = useState<Range>('week');
  const [hover, setHover] = useState<number | null>(null);

  const bars = useMemo(() => {
    if (range === 'week') return days.slice(-7).map((d) => ({ key: d.date, short: label(d.date, { weekday: 'short' }), long: label(d.date, { weekday: 'long', month: 'short', day: 'numeric' }), questions: d.questions, people: d.people }));
    const weeks = [days.slice(-28, -21), days.slice(-21, -14), days.slice(-14, -7), days.slice(-7)];
    return weeks.map((w, i) => ({
      key: `w${i}`, short: i === 3 ? 'This week' : `${label(w[0].date, { month: 'short', day: 'numeric' })}`,
      long: `${label(w[0].date, { month: 'short', day: 'numeric' })} – ${label(w[w.length - 1].date, { month: 'short', day: 'numeric' })}`,
      questions: w.reduce((n, d) => n + d.questions, 0), people: Math.max(0, ...w.map((d) => d.people)),
    }));
  }, [days, range]);

  const top = Math.max(4, ...bars.map((b) => b.questions));
  const step = Math.ceil(top / 4);
  const max = step * 4;
  const active = hover ?? bars.length - 1;

  return (
    <section className="dcard dchart" aria-labelledby="act-title">
      <div className="dcard-h">
        <div><h2 id="act-title">Assistant activity</h2><p className="muted small">Questions the team asked their assistants</p></div>
        <div className="dseg" role="group" aria-label="Range">
          <button aria-pressed={range === 'week'} onClick={() => { setRange('week'); setHover(null); }}>Last 7 days</button>
          <button aria-pressed={range === 'month'} onClick={() => { setRange('month'); setHover(null); }}>Last 4 weeks</button>
        </div>
      </div>
      <div className="dplot" onMouseLeave={() => setHover(null)}>
        <div className="dgrid" aria-hidden="true">
          {[4, 3, 2, 1, 0].map((i) => <div key={i}><span>{i * step}</span></div>)}
        </div>
        <ol className="dbars" aria-label={`Questions per ${range === 'week' ? 'day' : 'week'}`}>
          {bars.map((b, i) => (
            <li key={b.key} className={i === active ? 'on' : ''} onMouseEnter={() => setHover(i)}>
              <button className="dbar-col" onFocus={() => setHover(i)} aria-label={`${b.long}: ${b.questions} questions from ${b.people} people`}>
                <span className="dbar-ghost" />
                <span className="dbar" style={{ height: `${(b.questions / max) * 100}%` }} />
                {i === active && (
                  <span className={`dtip${i === 0 ? ' left' : i === bars.length - 1 ? ' right' : ''}`} role="status" style={{ bottom: `calc(${Math.min(68, (b.questions / max) * 100)}% + 10px)` }}>
                    <b>{b.long}</b>
                    <span><i className="dot-q" />Questions <strong>{b.questions}</strong></span>
                    <span><i className="dot-p" />People {range === 'month' ? '(busiest day)' : ''} <strong>{b.people}</strong></span>
                  </span>
                )}
              </button>
              <span className="dbar-x">{b.short}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
