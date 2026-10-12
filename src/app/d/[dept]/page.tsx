import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { StagePill, ToolChips } from '@/components/Bits';
import { requireDepartment } from '@/lib/auth/current-user';
import { departmentById, type DepartmentId } from '@/config/departments';
import { peopleIn, PEOPLE } from '@/config/people';
import { automationsFor, type Automation } from '@/data/automations';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'live', label: 'Live' },
] as const;

export default async function DepartmentPage({ params, searchParams }: { params: { dept: string }; searchParams: { show?: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const show = FILTERS.some((f) => f.key === searchParams.show) ? searchParams.show! : 'all';

  const all = automationsFor(dept.id);
  const keep = (a: Automation) => show === 'all' || (show === 'live' ? a.stage === 'live' : a.requested);
  // Members of the department, plus anyone else who owns automations filed here.
  const owners = [...new Set([...peopleIn(dept.id).map((p) => p.id), ...all.map((a) => a.ownerId)])]
    .map((id) => PEOPLE.find((p) => p.id === id)!)
    .filter(Boolean);

  return (
    <>
      <Header user={user} current={dept.id} />
      <main className="page">
        <section className="hero">
          <span className="eyebrow">Department</span>
          <h1>{dept.name}</h1>
          <p>{dept.blurb}</p>
        </section>

        <div className="section-head">
          <p className="muted small" style={{ margin: 0 }}>{all.length} automations · from each person&apos;s 10 requests in the CW AI Audit</p>
          <nav className="filters" aria-label="Filter">
            {FILTERS.map((f) => (
              <Link key={f.key} href={`/d/${dept.id}${f.key === 'all' ? '' : `?show=${f.key}`}`} aria-current={show === f.key}>{f.label}</Link>
            ))}
          </nav>
        </div>

        {owners.map((p) => {
          const list = all.filter((a) => a.ownerId === p.id && keep(a));
          return (
            <section key={p.id} className="person" aria-labelledby={`p-${p.id}`}>
              <div className="person-head">
                <span className="avatar" aria-hidden="true">{p.name[0]}</span>
                <h2 id={`p-${p.id}`} style={{ fontSize: 17 }}>{p.name}</h2>
                <span className="muted small">{all.filter((a) => a.ownerId === p.id).length} automations</span>
              </div>
              <div className="list">
                {list.length === 0 ? (
                  <p className="empty">{p.auditKey ? 'Nothing matches this filter.' : 'No AI audit requests yet. Their tasks will appear here once they fill in the Workflow Process Form.'}</p>
                ) : list.map((a) => (
                  <Link key={a.id} href={`/a/${a.id}`} className="item">
                    <span className="num">{a.n ? String(a.n).padStart(2, '0') : '★'}</span>
                    <div>
                      <h3>{a.title}</h3>
                      <p>{a.summary}</p>
                      <ToolChips a={a} />
                    </div>
                    <div className="side">
                      <StagePill a={a} />
                      {a.requested && a.stage !== 'live' && <span className="pill req">Requested</span>}
                      <span className="muted small">{a.difficulty}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
