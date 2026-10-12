// A department workspace (Option 2 in the CWU mockups): the department's tasks on the left, the selected
// task's assistant in the middle, and what the task touches in Keap and the other tools on the right.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { StagePill } from '@/components/Bits';
import { requireDepartment } from '@/lib/auth/current-user';
import { departmentById, type DepartmentId } from '@/config/departments';
import { personById } from '@/config/people';
import { automationsFor } from '@/data/automations';
import { integrationName } from '@/lib/integrations/registry';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { approveSteps, isConnected, primaryTool, starters } from '@/lib/workspace';
import { chatIsConfigured } from '@/lib/chat/routine';
import { storeIsPersistent } from '@/lib/store';
import { listSheets } from '@/lib/sheets';
import { TaskChat } from './TaskChat';
import { Sidebar } from './Sidebar';
import { KeapContact } from './KeapContact';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ params, searchParams }: { params: { dept: string }; searchParams: { t?: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const first = user.name.split(/\s+/)[0];

  // Team members only see their own tasks; super admins see everyone's, grouped by person.
  const all = automationsFor(dept.id).filter((a) => canViewAutomation(user, a));
  const mine = all.filter((a) => a.ownerId === user.id);
  const selected = all.find((a) => a.id === searchParams.t) ?? mine[0] ?? all[0];

  const keapOn = isConnected('keap');
  // Spreadsheets: your own (super admins: everyone's in this department) and the ones linked to this task.
  const sheets = (await listSheets()).filter((sh) => (isSuperAdmin(user) ? personById(sh.owner)?.departments.includes(dept.id as DepartmentId) || sh.owner === user.id : sh.owner === user.id));
  const sheetCount = sheets.length;
  const taskSheets = selected ? sheets.filter((sh) => sh.taskIds.includes(selected.id)) : [];
  const steps = selected ? approveSteps(selected) : [];
  const tool = selected ? primaryTool(selected) : null;
  const owner = selected ? personById(selected.ownerId) : null;

  return (
    <>
      <Header user={user} current={dept.id} />
      <div className="ws">
        <Sidebar user={user} dept={dept} tasks={all} selectedId={selected?.id} sheetCount={sheetCount} />

        {selected ? (
          <TaskChat
            key={selected.id}
            taskId={selected.id}
            title={selected.title}
            approveTool={tool}
            starters={starters(selected)}
            firstName={first}
            ready={chatIsConfigured() && storeIsPersistent()}
          />
        ) : <main className="ws-main" />}

        {selected && (
          <aside className="ws-panel" aria-label="Task details">
            <section>
              <h5>About this task</h5>
              <p className="ws-sum">{selected.summary}</p>
              <div className="row"><StagePill a={selected} />{owner && <span className="muted small">Owner: {owner.name}</span>}</div>
            </section>

            {selected.integrations.includes('keap') && (
              <section>
                <h5>Keap contact</h5>
                {keapOn ? <KeapContact taskId={selected.id} /> : (
                  <div className="ws-contact off"><div className="ws-ava">K</div><div><b>Keap isn&apos;t connected yet</b><small>Once it is, the contact you&apos;re working on shows here with their tags</small></div></div>
                )}
              </section>
            )}

            <section>
              <h5>Tools</h5>
              <div className="row">
                {selected.integrations.length === 0 && <span className="muted small">No tools needed</span>}
                {selected.integrations.map((id) => (
                  <span key={id} className={`tag${isConnected(id) ? ' on' : ''}`} title={isConnected(id) ? 'Connected' : 'Not connected yet'}>{integrationName(id)}</span>
                ))}
              </div>
            </section>

            <section>
              <h5>Spreadsheets</h5>
              {taskSheets.length === 0
                ? <p className="muted small" style={{ margin: 0 }}>No spreadsheets linked to this task yet.</p>
                : (
                  <ul className="ws-sheets">
                    {taskSheets.map((sh) => (
                      <li key={sh.id}><a href={sh.url} target="_blank" rel="noreferrer"><Icon name="table" size={14} /> {sh.name}</a><small>{sh.account}</small></li>
                    ))}
                  </ul>
                )}
              <Link href={`/w/${dept.id}/sheets?task=${selected.id}`} className="ws-more"><Icon name="plus" size={14} /> Add a spreadsheet</Link>
            </section>

            <section>
              <h5>When you approve{tool ? `, ${tool} will` : ', the hub will'}</h5>
              <div className="kflow">
                {steps.map((s, i) => (
                  <div key={s.title} className="kflow-item">
                    {i > 0 && <div className="kdown" aria-hidden="true">↓</div>}
                    <div className="kstep">
                      <span className="k">{i + 1}</span>
                      <div><b>{s.title}</b><small>{s.detail}</small>{!s.connected && <small className="wait">Not connected yet</small>}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted small" style={{ margin: 0 }}>Nothing is sent or changed until you press Approve.</p>
            </section>

            <Link href={`/a/${selected.id}`} className="ws-more"><Icon name="info" size={14} /> Full task details</Link>
          </aside>
        )}
      </div>
    </>
  );
}
