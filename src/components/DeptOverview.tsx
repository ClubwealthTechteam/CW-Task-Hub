// Home page overview: how far each department's automations have come, as charts. Server-rendered SVG and
// CSS only (no chart library). Each department row opens its workspace.

import Link from 'next/link';
import type { Automation } from '@/data/automations';
import type { Department } from '@/config/departments';
import { peopleIn } from '@/config/people';

const initials = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function Ring({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg className="ov-ring" viewBox="0 0 128 128" role="img" aria-label={`${pct}% of automations are live`}>
      <circle cx="64" cy="64" r={r} className="ov-ring-bg" />
      <circle cx="64" cy="64" r={r} className="ov-ring-fg" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" className="ov-ring-n">{pct}%</text>
      <text x="64" y="82" textAnchor="middle" className="ov-ring-l">live</text>
    </svg>
  );
}

export function DeptOverview({ depts, all }: { depts: Department[]; all: Automation[] }) {
  const rows = depts.map((d) => {
    const list = all.filter((a) => a.department === d.id);
    const live = list.filter((a) => a.stage === 'live').length;
    const building = list.filter((a) => a.stage === 'building').length;
    return { d, total: list.length, live, building, planned: list.length - live - building, people: peopleIn(d.id) };
  });
  const sum = (k: 'total' | 'live' | 'building' | 'planned') => rows.reduce((n, r) => n + r[k], 0);
  const total = sum('total');
  const pct = total ? Math.round((sum('live') / total) * 100) : 0;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const people = new Set(rows.flatMap((r) => r.people.map((p) => p.id))).size;

  return (
    <section className="card ov" aria-labelledby="ov-title">
      <div className="ov-head">
        <div>
          <h2 id="ov-title">Departments at a glance</h2>
          <p className="muted small">How many automations each department has, and how many are live. Select a department to open it.</p>
        </div>
        <ul className="ov-legend" aria-label="Legend">
          <li><i className="seg-live" />Live</li>
          <li><i className="seg-building" />In progress</li>
          <li><i className="seg-planned" />Planned</li>
        </ul>
      </div>

      <div className="ov-top">
        <Ring pct={pct} />
        <dl className="ov-kpis">
          <div><dt>Automations</dt><dd>{total}</dd></div>
          <div className="k-live"><dt>Live</dt><dd>{sum('live')}</dd></div>
          <div><dt>In progress</dt><dd>{sum('building')}</dd></div>
          <div><dt>Planned</dt><dd>{sum('planned')}</dd></div>
          <div><dt>People</dt><dd>{people}</dd></div>
        </dl>
      </div>

      <ol className="ov-chart" aria-label="Automations by department">
        {rows.map((r) => (
          <li key={r.d.id}>
            <Link href={`/w/${r.d.id}`} className="ov-row" aria-label={`${r.d.name}: ${r.live} of ${r.total} live, ${r.people.length} people`}>
              <span className="ov-name">
                <b>{r.d.name}</b>
                {r.d.hidden && <span className="pill gold">Admins only</span>}
                <span className="ov-people" aria-hidden="true">
                  {r.people.slice(0, 4).map((p) => <span key={p.id} title={p.name}>{initials(p.name)}</span>)}
                  {r.people.length > 4 && <span>+{r.people.length - 4}</span>}
                </span>
              </span>
              <span className="ov-track" aria-hidden="true">
                <span className="ov-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                  {r.live > 0 && <span className="seg-live" style={{ flexGrow: r.live }} />}
                  {r.building > 0 && <span className="seg-building" style={{ flexGrow: r.building }} />}
                  {r.planned > 0 && <span className="seg-planned" style={{ flexGrow: r.planned }} />}
                </span>
              </span>
              <span className="ov-count"><b>{r.live}</b><span>/ {r.total} live</span></span>
              <span className="ov-go" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
