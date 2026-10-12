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
import { automationsFor, type Automation } from '@/data/automations';
import { integrationName } from '@/lib/integrations/registry';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { approveSteps, isConnected, primaryTool, starters, taskIcon } from '@/lib/workspace';
import { chatIsConfigured } from '@/lib/chat/routine';
import { storeIsPersistent } from '@/lib/store';
import { TaskChat } from './TaskChat';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ params, searchParams }: { params: { dept: string }; searchParams: { t?: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const first = user.name.split(/\s+/)[0];

  // Team members only see their own tasks; super admins see everyone's, grouped by person.
  const all = automationsFor(dept.id).filter((a) => canViewAutomation(user, a));
  const mine = all.filter((a) => a.ownerId === user.id);
  const byOwner = new Map<string, Automation[]>();
  for (const a of all) if (a.ownerId !== user.id) byOwner.set(a.ownerId, [...(byOwner.get(a.ownerId) ?? []), a]);
  const selected = all.find((a) => a.id === searchParams.t) ?? mine[0] ?? all[0];

  const keapOn = isConnected('keap');
  const steps = selected ? approveSteps(selected) : [];
  const tool = selected ? primaryTool(selected) : null;
  const owner = selected ? personById(selected.ownerId) : null;

  const navItem = (a: Automation) => (
    <Link key={a.id} href={`/w/${dept.id}?t=${a.id}`} className="ws-nav" aria-current={a.id === selected?.id ? 'page' : undefined} title={a.title}>
      <Icon name={taskIcon(a)} />
      <span>{a.title}</span>
      {a.stage === 'live' && <span className="ws-live" title="Live">Live</span>}
    </Link>
  );

  return (
    <>
      <Header user={user} current={dept.id} />
      <div className="ws">
        <aside className="ws-side" aria-label={`${dept.name} tasks`}>
          <div className="ws-side-h"><b>{dept.name}</b><span>AI Task Hub · {first}</span></div>
          <nav className="ws-navs">
            {mine.length > 0 && (<><div className="ws-group">My tasks</div>{mine.map(navItem)}</>)}
            {[...byOwner].map(([id, list]) => (
              <div key={id} className="ws-navs">
                <div className="ws-group">{personById(id)?.name.split(/\s+/)[0] ?? id}&apos;s tasks</div>
                {list.map(navItem)}
              </div>
            ))}
            {all.length === 0 && <p className="ws-empty">{isSuperAdmin(user) ? 'No tasks in this department yet.' : 'You don’t have any tasks yet. Ask Miguel to add yours from the AI audit.'}</p>}
          </nav>
          <div className="ws-side-f">
            <span className={`keap-pill${keapOn ? '' : ' off'}`}>{keapOn ? 'Keap connected' : 'Keap not connected'}</span>
          </div>
        </aside>

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
                {keapOn ? (
                  <div className="ws-contact"><div className="ws-ava">?</div><div><b>No contact picked</b><small>Contact lookup is added when this task is built</small></div></div>
                ) : (
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
