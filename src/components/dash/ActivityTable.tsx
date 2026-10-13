'use client';

// Recent assistant activity across the team, with search and sort. Shows which task and how it went, never
// what was said (that stays in each person's chat).

import { useMemo, useState } from 'react';
import type { ActivityRow } from '@/lib/dashboard';

type Sort = 'newest' | 'person' | 'dept' | 'messages';
const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
const STATUS = { done: 'Answered', waiting: 'Waiting', failed: 'Failed' } as const;

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) => words.every((w) => `${r.person} ${r.dept} ${r.task}`.toLowerCase().includes(w)));
    const by: Record<Sort, (a: ActivityRow, b: ActivityRow) => number> = {
      newest: (a, b) => b.at - a.at, person: (a, b) => a.person.localeCompare(b.person) || b.at - a.at,
      dept: (a, b) => a.dept.localeCompare(b.dept) || b.at - a.at, messages: (a, b) => b.messages - a.messages,
    };
    return [...list].sort(by[sort]).slice(0, 12);
  }, [rows, q, sort]);

  return (
    <section className="dcard" aria-labelledby="ra-title">
      <div className="dcard-h">
        <div><h2 id="ra-title">Recent activity</h2><p className="muted small">The latest assistant chats across the team</p></div>
        <div className="row dtools">
          <label className="dsearch"><span aria-hidden="true">⌕</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or tasks" aria-label="Search activity" /></label>
          <label className="dsort"><span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest</option><option value="person">Person</option><option value="dept">Department</option><option value="messages">Most questions</option>
            </select>
          </label>
        </div>
      </div>
      {shown.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{rows.length ? 'Nothing matches.' : 'No assistant activity in the last 4 weeks.'}</p> : (
        <div className="table-wrap dtable">
          <table>
            <thead><tr><th>Person</th><th>Department</th><th>Task</th><th>Last activity</th><th className="num">Questions</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><span className="dwho"><span className="dava">{r.person.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>{r.person}</span></td>
                  <td>{r.dept}</td>
                  <td className="dtask">{r.task}</td>
                  <td>{when(r.at)}</td>
                  <td className="num">{r.messages}</td>
                  <td><span className={`dstatus s-${r.status}`}>{STATUS[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
