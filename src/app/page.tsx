import Link from 'next/link';
import { Header } from '@/components/Header';
import { StagePill } from '@/components/Bits';
import { requireUser } from '@/lib/auth/current-user';
import { visibleDepartments, isSuperAdmin } from '@/lib/access';
import { automationsFor, automationsOwnedBy } from '@/data/automations';
import { peopleIn } from '@/config/people';
import { listRuns } from '@/lib/automations/runner';
import { personById } from '@/config/people';
import { automationById } from '@/data/automations';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireUser();
  const depts = visibleDepartments(user);
  const mine = automationsOwnedBy(user.id);
  const runs = isSuperAdmin(user) ? (await listRuns()).slice(0, 8) : [];
  const first = user.name.split(' ')[0];

  return (
    <>
      <Header user={user} current="home" />
      <main className="page">
        <section className="hero">
          <span className="eyebrow">AI Task Hub</span>
          <h1>Hi {first}, here are your automations</h1>
          <p>{isSuperAdmin(user) ? 'You can see every department and manage integrations.' : 'Open your department to run your tools. Each one shows its plan and what it still needs.'}</p>
        </section>

        <section className="grid" aria-label="Departments">
          {depts.map((d) => {
            const list = automationsFor(d.id);
            return (
              <Link key={d.id} href={`/d/${d.id}`} className="card">
                <div className="spread"><h2>{d.name}</h2>{d.hidden && <span className="pill gold">Admins only</span>}</div>
                <p className="muted small" style={{ margin: 0 }}>{d.blurb}</p>
                <div className="stats">
                  <div className="stat"><b>{list.length}</b><span>automations</span></div>
                  <div className="stat"><b>{list.filter((a) => a.stage === 'live').length}</b><span>live</span></div>
                  <div className="stat"><b>{peopleIn(d.id).length}</b><span>people</span></div>
                </div>
              </Link>
            );
          })}
        </section>

        {mine.length > 0 && (
          <section className="card">
            <h2>My automations</h2>
            <div className="list">
              {mine.map((a) => (
                <Link key={a.id} href={`/a/${a.id}`} className="item">
                  <span className="num">{a.n ? String(a.n).padStart(2, '0') : '★'}</span>
                  <div><h3>{a.title}</h3><p>{a.summary}</p></div>
                  <div className="side"><StagePill a={a} /></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {isSuperAdmin(user) && (
          <section className="card">
            <h2>Recent runs</h2>
            {runs.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No runs yet.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>When</th><th>Who</th><th>Automation</th><th>Result</th></tr></thead>
                  <tbody>
                    {runs.map((r, i) => (
                      <tr key={i}>
                        <td>{new Date(r.at).toLocaleString()}</td>
                        <td>{personById(r.by)?.name ?? r.by}</td>
                        <td>{automationById(r.automationId)?.title ?? r.automationId}</td>
                        <td>{r.mode === 'dry_run' ? 'Plan (skeleton)' : r.ok ? 'Done' : 'Failed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
