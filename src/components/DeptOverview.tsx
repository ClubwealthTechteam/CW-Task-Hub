// Home dashboard: each department's automations as a stacked bar (live / in progress / planned), scaled to
// the largest department. Each row opens the department's workspace. Server-rendered, no chart library.

import Link from 'next/link';
import type { Automation } from '@/data/automations';
import type { Department } from '@/config/departments';
import { peopleIn } from '@/config/people';

const initials = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const stageCounts = (list: Automation[]) => {
  const live = list.filter((a) => a.stage === 'live').length;
  const building = list.filter((a) => a.stage === 'building').length;
  return { total: list.length, live, building, planned: list.length - live - building };
};

export function DeptOverview({ depts, all }: { depts: Department[]; all: Automation[] }) {
  const rows = depts.map((d) => ({ d, ...stageCounts(all.filter((a) => a.department === d.id)), people: peopleIn(d.id) }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section className="dcard" aria-labelledby="ov-title">
      <div className="dcard-h">
        <div><h2 id="ov-title">Departments</h2><p className="muted small">Automations per department. Select one to open it.</p></div>
        <ul className="ov-legend" aria-label="Legend">
          <li><i className="seg-live" />Live</li><li><i className="seg-building" />In progress</li><li><i className="seg-planned" />Planned</li>
        </ul>
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
