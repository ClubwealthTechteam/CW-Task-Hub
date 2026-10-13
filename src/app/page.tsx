import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { StagePill } from '@/components/Bits';
import { requireUser } from '@/lib/auth/current-user';
import { visibleDepartments, isSuperAdmin } from '@/lib/access';
import { allAutomations } from '@/data/catalog';
import { peopleIn } from '@/config/people';
import { listRuns } from '@/lib/automations/runner';
import { PEOPLE, personById } from '@/config/people';
import { DEPARTMENTS } from '@/config/departments';
import { announcementsFor, toView } from '@/lib/announcements';
import { getViewer } from '@/lib/auth/current-user';
import { Announcements } from '@/components/Announcements';
import { listReports } from '@/lib/council/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireUser();
  // Team members go straight to their department workspace; this overview is for super admins.
  if (!isSuperAdmin(user)) redirect(`/w/${user.departments[0]}`);
  const depts = visibleDepartments(user);
  const all = await allAutomations();
  const mine = all.filter((a) => a.ownerId === user.id);
  const runs = isSuperAdmin(user) ? (await listRuns()).slice(0, 8) : [];
  const first = user.name.split(' ')[0];
  const updates = (await announcementsFor(user)).map(toView);
  const council = (await listReports())[0];
  const preview = Boolean((await getViewer())?.preview);

  return (
    <>
      <Header user={user} current="home" />
      <main className="page">
        <section className="hero">
          <span className="eyebrow">AI Task Hub</span>
          <h1>Hi {first}, here are your automations</h1>
          <p>{isSuperAdmin(user) ? 'You can see every department and manage integrations.' : 'Open your department to run your tools. Each one shows its plan and what it still needs.'}</p>
        </section>

        {council && council.overall !== 'ok' && (
          <Link href="/council" className={`council-alert lvl-b-${council.overall}`}>
            <b>{council.overall === 'fail' ? 'The council found a problem' : 'The council flagged something'}</b>
            <span>{council.headline}</span>
            <span className="small">Open the Council →</span>
          </Link>
        )}

        <section className="card" aria-labelledby="updates-title">
          <div className="spread"><h2 id="updates-title">Updates &amp; announcements</h2><span className="muted small">Team members see these at the top of their workspace</span></div>
          <Announcements items={updates} admin limit={5} preview={preview} departments={DEPARTMENTS.filter((d) => !d.hidden).map((d) => ({ id: d.id, name: d.name }))} />
        </section>

        <section className="grid" aria-label="Departments">
          {depts.map((d) => {
            const list = all.filter((a) => a.department === d.id);
            return (
              <Link key={d.id} href={`/w/${d.id}`} className="card">
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
                <Link key={a.id} href={`/w/${a.department}?t=${a.id}`} className="item">
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
            <h2>Preview someone’s view</h2>
            <p className="muted small" style={{ margin: 0 }}>See the hub exactly as a team member does, to check it before handing it over. Read-only: nothing can be sent or changed, and their chats stay hidden.</p>
            <div className="row">
              {PEOPLE.filter((p) => p.role !== 'super_admin').map((p) => (
                <a key={p.id} className="chip" href={`/api/preview?as=${p.id}`}>{p.name}</a>
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
                        <td>{all.find((a) => a.id === r.automationId)?.title ?? r.automationId}</td>
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
