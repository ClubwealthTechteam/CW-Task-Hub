import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { StagePill, ToolChips } from '@/components/Bits';
import { requireDepartment } from '@/lib/auth/current-user';
import { findAutomation } from '@/data/catalog';
import { departmentById } from '@/config/departments';
import { personById } from '@/config/people';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { RunPanel } from './RunPanel';

export const dynamic = 'force-dynamic';

export default async function AutomationPage({ params }: { params: { id: string } }) {
  const a = await findAutomation(params.id);
  if (!a) notFound();
  const user = await requireDepartment(a.department);
  if (!canViewAutomation(user, a)) notFound();
  const dept = departmentById(a.department)!;
  const owner = personById(a.ownerId);

  return (
    <>
      <Header user={user} current={a.department} />
      <main className="page">
        <nav className="small"><Link href={`/w/${dept.id}?t=${a.id}`}>← Back to the {dept.name} workspace</Link></nav>
        <section className="hero">
          <span className="eyebrow">{owner?.name} · {dept.name}</span>
          <h1>{a.title}</h1>
          <p>{a.summary}</p>
          <div className="row"><StagePill a={a} />{a.requested && <span className="pill req">Requested</span>}</div>
        </section>

        <div className="detail">
          <section className="card">
            <h2>About this automation</h2>
            <dl className="kv">
              <dt>Owner</dt><dd>{owner?.name}</dd>
              <dt>Tools it needs</dt><dd><ToolChips a={a} /><div className="muted small" style={{ marginTop: 4 }}>{a.integrationNote}</div></dd>
              <dt>Difficulty</dt><dd>{a.difficulty}</dd>
              <dt>Recommendation</dt><dd>{a.recommendation}</dd>
              <dt>Audit status</dt><dd>{a.auditStatus}</dd>
              {a.runsIn && (<><dt>Runs in</dt><dd>{a.runsIn}</dd></>)}
            </dl>
            {a.integrations.includes('keap') && (
              <p className="note" style={{ margin: 0 }}>
                Uses Keap. Once built, it will run through the hub&apos;s Keap shortcuts (tags, campaigns and API goals){isSuperAdmin(user) ? <> — see <Link href="/admin/integrations">Integrations</Link></> : null}.
              </p>
            )}
          </section>
          <RunPanel id={a.id} live={a.stage === 'live'} />
        </div>
      </main>
    </>
  );
}
