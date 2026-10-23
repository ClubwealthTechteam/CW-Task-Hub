// SOP Handbook: one numbered article per recurring admin task, each with a Main Admin and a POC Admin who
// covers it when the Main is out (Miguel's Admin SOP Handbook proposal, Oct 2026). Open to everyone signed in,
// since a POC may come from another department.

import Link from 'next/link';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { DEPARTMENTS } from '@/config/departments';
import { personById } from '@/config/people';
import { SOP_ARTICLES } from '@/data/sop';
import { outToday } from '@/lib/sop';
import { OutToggle } from '@/components/sop/SopControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SOP Handbook · CW AI Task Hub' };

const first = (id: string | null) => (id ? personById(id)?.name.split(/\s+/)[0] ?? id : null);

export default async function SopHandbookPage() {
  const user = await requireUser();
  const out = await outToday();
  const isMain = SOP_ARTICLES.some((a) => a.main === user.id);
  const depts = DEPARTMENTS.filter((d) => SOP_ARTICLES.some((a) => a.department === d.id));

  return (
    <>
      <Header user={user} current="sop" />
      <main className="page sop">
        <section className="hero">
          <span className="eyebrow">SOP Handbook</span>
          <h1>Every task keeps running when someone is out</h1>
          <p>One numbered article per recurring admin task. Each names the Main Admin who owns it and the POC Admin who covers it, and walks through the steps so the POC can follow them on the day. No training needed.</p>
        </section>

        <section className="sop-parts">
          <div className="card"><h3>SOP articles</h3><p className="muted small">A numbered guide per task (e.g. EV-01). Open it by its number and follow it step by step.</p></div>
          <div className="card"><h3>Main + POC</h3><p className="muted small">Every task has two names: the Main Admin who owns it and the POC Admin who covers it when the Main is out.</p></div>
          <div className="card"><h3>One main sheet</h3><p className="muted small">Each article names the one sheet the task works from. Old copies move to an archive so nothing is lost.</p></div>
          <div className="card"><h3>If it breaks</h3><p className="muted small">Every article has a manual way to finish the task when a sheet or automation breaks, and who to tell.</p></div>
        </section>

        <section className="card">
          <h2>When the Main Admin is out</h2>
          <ol className="sop-flow">
            <li><b>Main Admin</b> marks themselves out below. Their tasks show the POC as covering.</li>
            <li><b>POC Admin</b> opens the task’s article by its number and follows the steps as written.</li>
            <li><b>POC Admin</b> uses the article’s <b>If it breaks</b> steps if a sheet or automation fails.</li>
            <li><b>POC Admin</b> adds a row to the article’s POC log for each task done: what was done, anything unusual.</li>
            <li><b>Main Admin</b> reads the log rows when back and picks up where the POC stopped.</li>
            <li><b>Everyone:</b> if a step was unclear or wrong, the article is fixed the same day (tell Miguel) and its date changes.</li>
          </ol>
          {isMain && <OutToggle out={out.has(user.id)} />}
        </section>

        {depts.map((d) => (
          <section key={d.id} className="card">
            <h2>{d.name}</h2>
            <div className="tw">
              <table className="sop-index">
                <thead><tr><th>No.</th><th>Task</th><th>Main Admin</th><th>POC Admin</th><th>Status</th></tr></thead>
                <tbody>
                  {SOP_ARTICLES.filter((a) => a.department === d.id).map((a) => {
                    const mainOut = out.has(a.main);
                    return (
                      <tr key={a.id}>
                        <td data-label="No."><Link href={`/sop/${a.id}`} className="sop-no">{a.id}</Link></td>
                        <td data-label="Task"><Link href={`/sop/${a.id}`}>{a.title}</Link><div className="muted small">{a.when}</div></td>
                        <td data-label="Main Admin">{first(a.main)}{mainOut && <span className="pill req sop-out">Out today</span>}</td>
                        <td data-label="POC Admin">{first(a.poc) ?? <span className="muted">To be named</span>}{mainOut && a.poc && <span className="pill live sop-out">Covering</span>}</td>
                        <td data-label="Status"><span className={`pill ${a.status === 'ready' ? 'live' : ''}`}>{a.status === 'ready' ? 'Ready' : 'Draft'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="muted small">An article is marked <b>Ready</b> once its POC has run it once while the Main Admin watched (15–30 minutes, one time only). Until then it’s a <b>Draft</b>. To add an article or fix a step, tell Miguel.</p>
      </main>
    </>
  );
}
