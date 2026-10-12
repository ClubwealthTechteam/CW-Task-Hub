// The Workflow Process Form submissions behind a workspace's form tasks, read live from the responses sheet.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireDepartment } from '@/lib/auth/current-user';
import { departmentById, type DepartmentId } from '@/config/departments';
import { personById } from '@/config/people';
import { automationsInDept } from '@/data/catalog';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { listSheets } from '@/lib/sheets';
import { getSubmissions, type FormProcess } from '@/lib/forms/submissions';
import { Sidebar } from '../Sidebar';

export const dynamic = 'force-dynamic';

function Process({ p }: { p: FormProcess }) {
  return (
    <div className="fp">
      <h3>{p.title}</h3>
      <ol>
        {p.steps.map((s, i) => (
          <li key={i}>
            <b>{s.tool}</b>
            <span>{s.description}</span>
            {s.outcomes.map((o) => <small key={o.label}>{o.label}: {o.result}</small>)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function FormsPage({ params }: { params: { dept: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const admin = isSuperAdmin(user);
  const tasks = (await automationsInDept(dept.id as DepartmentId)).filter((a) => canViewAutomation(user, a));
  const all = await getSubmissions();
  const subs = all.filter((s) => (admin ? personById(s.personId ?? '')?.departments.includes(dept.id as DepartmentId) : s.personId === user.id));
  const unmatched = admin ? all.filter((s) => !s.personId) : [];
  const sheets = (await listSheets()).filter((s) => s.owner === user.id || (admin && personById(s.owner)?.departments.includes(dept.id as DepartmentId)));

  return (
    <>
      <Header user={user} current={dept.id} />
      <div className="ws ws-wide">
        <Sidebar user={user} dept={dept} tasks={tasks} sheetCount={sheets.length} formCount={subs.length} onForms />
        <main className="ws-page">
          <div className="ws-page-h">
            <h1>{admin ? `${dept.name} process forms` : 'My process forms'}</h1>
            <p>What {admin ? 'the team' : 'you'} described in the Workflow Process Form. Each process becomes a task with a build plan under “From my process form”. New submissions show up here within about 5 minutes.</p>
          </div>

          {subs.length === 0 && (
            <section className="card"><p className="muted" style={{ margin: 0 }}>No submissions yet{admin ? ' from this department' : ''}. Once {admin ? 'someone fills' : 'you fill'} in the Workflow Process Form, it appears here.</p></section>
          )}

          {subs.map((s) => {
            const made = tasks.filter((t) => t.submissionId === s.id);
            return (
              <section key={s.id} className="card fsub">
                <div className="spread">
                  <h2>{s.name}</h2>
                  <span className="muted small">{s.submittedAt} · {s.id}</span>
                </div>
                {made.length > 0 && (
                  <div className="row">
                    <span className="muted small">Tasks:</span>
                    {made.map((t) => <Link key={t.id} href={`/w/${dept.id}?t=${t.id}`} className="chip">{t.title}</Link>)}
                  </div>
                )}
                {[...s.tools.web, ...s.tools.apps, ...s.tools.spreadsheets].length > 0 && (
                  <p className="small" style={{ margin: 0 }}><b>Tools:</b> {[...s.tools.web, ...s.tools.apps, ...s.tools.spreadsheets].join(', ')}</p>
                )}
                <details open>
                  <summary><b>How it’s done now</b></summary>
                  {s.manualProcesses.length ? s.manualProcesses.map((p) => <Process key={p.title} p={p} />) : <p className="fp-text">{s.manualOverview}</p>}
                </details>
                {(s.idealOverview || s.idealProcesses.length > 0) && (
                  <details>
                    <summary><b>Ideal automated version</b></summary>
                    {s.idealOverview && <p className="fp-text">{s.idealOverview}</p>}
                    {s.idealProcesses.map((p) => <Process key={p.title} p={p} />)}
                  </details>
                )}
                {([['Information needed', s.info], ['Manual / repetitive steps', s.repetitive], ['Judgment / approval', s.judgment], ['Bottlenecks & workarounds', s.bottlenecks], ['Preferred platform', s.platform]] as const)
                  .filter(([, v]) => v && !/^n\/?a$/i.test(v.trim()))
                  .map(([k, v]) => <p key={k} className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}><b>{k}:</b> {v}</p>)}
              </section>
            );
          })}

          {unmatched.length > 0 && (
            <section className="card">
              <h2>Not matched to anyone in the hub</h2>
              <p className="muted small" style={{ margin: 0 }}>These names didn’t match a hub person, so no tasks were made: {unmatched.map((s) => `${s.name} (${s.id})`).join(', ')}.</p>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
