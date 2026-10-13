// A department workspace (Option 2 in the CWU mockups): the department's tasks on the left, the selected
// task's assistant in the middle, and what the task touches in Keap and the other tools on the right.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { StagePill } from '@/components/Bits';
import { getViewer, requireDepartment } from '@/lib/auth/current-user';
import { departmentById, type DepartmentId } from '@/config/departments';
import { personById } from '@/config/people';
import { automationsInDept } from '@/data/catalog';
import { integrationName } from '@/lib/integrations/registry';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { approveSteps, isConnected, primaryTool, starters } from '@/lib/workspace';
import { chatIsConfigured } from '@/lib/chat/routine';
import { storeIsPersistent } from '@/lib/store';
import { listSheets } from '@/lib/sheets';
import { getSubmissions } from '@/lib/forms/submissions';
import { TaskChat } from './TaskChat';
import { Sidebar } from './Sidebar';
import { KeapContact } from './KeapContact';
import { SidePanel } from './SidePanel';
import { Tour } from '@/components/Tour';
import { ContentCalendar } from '@/components/calendar/ContentCalendar';
import { calendarDeptForTask, calendarTeam, canUseCalendar } from '@/lib/calendar-access';
import { todayPacific } from '@/lib/calendar-dates';
import { canUseFiles } from '@/lib/chat/files';
import { ContentTemplates } from '@/components/ContentTemplates';
import { WelcomePosts } from '@/components/welcome/WelcomePosts';
import { ReferralBoard } from '@/components/referrals/ReferralBoard';
import { canUseWelcome } from '@/lib/welcome/access';
import { UpdatesBanner } from '@/components/Announcements';
import { announcementsFor, toView } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

const PLAN_LABEL = { read: 'Reads', draft: 'Drafts for you', approval: 'Needs approval', assist: 'Assists' } as const;

export default async function WorkspacePage({ params, searchParams }: { params: { dept: string }; searchParams: { t?: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const first = user.name.split(/\s+/)[0];
  const preview = Boolean((await getViewer())?.preview);

  // Team members only see their own tasks; super admins see everyone's, grouped by person.
  const all = (await automationsInDept(dept.id as DepartmentId)).filter((a) => canViewAutomation(user, a));
  const mine = all.filter((a) => a.ownerId === user.id);
  const selected = all.find((a) => a.id === searchParams.t) ?? mine[0] ?? all[0];

  const updates = (await announcementsFor(user)).map(toView);
  const keapOn = isConnected('keap');
  // Spreadsheets: your own (super admins: everyone's in this department) and the ones linked to this task.
  const sheets = (await listSheets()).filter((sh) => (isSuperAdmin(user) ? personById(sh.owner)?.departments.includes(dept.id as DepartmentId) || sh.owner === user.id : sh.owner === user.id));
  const sheetCount = sheets.length;
  const formCount = (await getSubmissions()).filter((s) => (isSuperAdmin(user) ? personById(s.personId ?? '')?.departments.includes(dept.id as DepartmentId) : s.personId === user.id)).length;
  const taskSheets = selected ? sheets.filter((sh) => sh.taskIds.includes(selected.id)) : [];
  const steps = selected ? approveSteps(selected) : [];
  const tool = selected ? primaryTool(selected) : null;
  const owner = selected ? personById(selected.ownerId) : null;

  const calendarDept = selected && calendarDeptForTask(selected.id) && canUseCalendar(user, dept.id) ? dept.id : undefined;
  // Jay's task #1: the welcome posts board in the middle.
  const welcome = selected?.id === 'jaymar-1' && dept.id === 'social-media' && canUseWelcome(user);
  // Jay's task #8: the referral prospecting board.
  const referrals = selected?.id === 'jaymar-8' && dept.id === 'social-media' && canUseWelcome(user);
  const toolInMiddle = Boolean(calendarDept || welcome || referrals);
  const chat = selected ? (
    <TaskChat
      key={selected.id}
      taskId={selected.id}
      title={selected.title}
      approveTool={tool}
      starters={starters(selected)}
      firstName={first}
      ready={chatIsConfigured() && storeIsPersistent()}
      preview={preview}
      inPanel={toolInMiddle}
      canAttach={dept.id === 'social-media' && canUseFiles(user) && !preview}
    />
  ) : null;
  // Social Media: ready-made content prompts beside the assistant.
  const templates = selected && dept.id === 'social-media' ? <ContentTemplates taskId={selected.id} /> : null;
  const details = selected ? (
    <>
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

      {selected.source === 'form' && selected.plan ? (
        <section>
          <h5>Build plan · from your process form</h5>
          {selected.manualTime && <p className="muted small" style={{ margin: 0 }}>Takes about <b>{selected.manualTime}</b> by hand today.</p>}
          <ol className="plan">
            {selected.plan.map((p, i) => (
              <li key={i}>
                <span className={`plan-mode ${p.mode}`}>{PLAN_LABEL[p.mode]}</span>
                <div><b>{p.tool}</b><span>{p.action}</span>{p.branches?.map((b) => <small key={b}>{b}</small>)}</div>
              </li>
            ))}
          </ol>
          {selected.ideal && <blockquote className="ideal"><b>Your ideal version</b>{selected.ideal}</blockquote>}
          <p className="muted small" style={{ margin: 0 }}>Steps marked “Needs approval” change Keap or another system. They stay off until Miguel approves them; Keap is view-only for now.</p>
        </section>
      ) : (
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
      )}

      <Link href={`/a/${selected.id}`} className="ws-more"><Icon name="info" size={14} /> Full task details</Link>
    </>
  ) : null;

  return (
    <>
      <Header user={user} current={dept.id} />
      <div className="ws with-updates">
        <UpdatesBanner items={updates} />
        <Sidebar user={user} dept={dept} tasks={all} selectedId={selected?.id} sheetCount={sheetCount} formCount={formCount} />

        {selected && calendarDept ? (
          <ContentCalendar dept={calendarDept} taskId={selected.id} team={calendarTeam(calendarDept).map((p) => ({ id: p.id, name: p.name }))} today={todayPacific()} readOnly={preview} />
        ) : selected && welcome ? (
          <WelcomePosts taskId={selected.id} readOnly={preview} />
        ) : selected && referrals ? (
          <ReferralBoard readOnly={preview} />
        ) : selected ? chat : <main className="ws-main" />}

        {selected && (
          toolInMiddle
            ? <SidePanel label="Assistant & details" tabs={[
                { id: 'assistant', label: 'Assistant', content: chat },
                ...(templates ? [{ id: 'templates', label: 'Templates', content: templates }] : []),
                { id: 'details', label: 'Task details', content: details },
              ]} />
            : templates
              ? <SidePanel label="Templates & details" tabs={[{ id: 'templates', label: 'Templates', content: templates }, { id: 'details', label: 'Task details', content: details }]} />
              : <SidePanel>{details}</SidePanel>
        )}
      </div>
      {!preview && <Tour />}
    </>
  );
}
