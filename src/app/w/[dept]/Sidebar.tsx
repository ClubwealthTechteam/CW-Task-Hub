import Link from 'next/link';
import type { Person } from '@/config/people';
import type { Department } from '@/config/departments';
import { personById } from '@/config/people';
import type { Automation } from '@/data/automations';
import { isSuperAdmin } from '@/lib/access';
import { isConnected, taskIcon } from '@/lib/workspace';
import { Icon } from '@/components/Icon';

interface Props {
  user: Person;
  dept: Department;
  tasks: Automation[];          // already filtered to what this person may see
  selectedId?: string;
  sheetCount: number;
  formCount?: number;
  onSheets?: boolean;
  onForms?: boolean;
}

export function Sidebar({ user, dept, tasks, selectedId, sheetCount, formCount, onSheets, onForms }: Props) {
  const mineAll = tasks.filter((a) => a.ownerId === user.id);
  const mine = mineAll.filter((a) => a.source !== 'form');
  const mineForm = mineAll.filter((a) => a.source === 'form');
  const byOwner = new Map<string, Automation[]>();
  for (const a of tasks) if (a.ownerId !== user.id) byOwner.set(a.ownerId, [...(byOwner.get(a.ownerId) ?? []), a]);
  const keapOn = isConnected('keap');

  const navItem = (a: Automation) => (
    <Link key={a.id} href={`/w/${dept.id}?t=${a.id}`} className="ws-nav" aria-current={a.id === selectedId ? 'page' : undefined} title={a.title}>
      <Icon name={taskIcon(a)} />
      <span>{a.title}</span>
      {a.stage === 'live' && <span className="ws-live" title="Live">Live</span>}
    </Link>
  );

  return (
    <aside className="ws-side" aria-label={`${dept.name} tasks`}>
      <div className="ws-side-h"><b>{dept.name}</b><span>AI Task Hub · {user.name.split(/\s+/)[0]}</span></div>
      <nav className="ws-navs">
        {mineForm.length > 0 && (<><div className="ws-group">From my process form</div>{mineForm.map(navItem)}</>)}
        {mine.length > 0 && (<><div className="ws-group">My tasks</div>{mine.map(navItem)}</>)}
        {/* Super admins: each person's tasks fold into a dropdown; the one holding the open task starts open. */}
        {[...byOwner].map(([id, list]) => (
          <details key={id} className="ws-fold" open={list.some((a) => a.id === selectedId)}>
            <summary className="ws-group">
              <span>{personById(id)?.name.split(/\s+/)[0] ?? id}&apos;s tasks</span>
              <span className="ws-count">{list.length}</span>
            </summary>
            <div className="ws-navs">{list.map(navItem)}</div>
          </details>
        ))}
        {tasks.length === 0 && <p className="ws-empty">{isSuperAdmin(user) ? 'No tasks in this department yet.' : 'You don’t have any tasks yet. Fill in the Workflow Process Form and your processes show up here.'}</p>}
      </nav>
      <div className="ws-side-f">
        <Link href={`/w/${dept.id}/forms`} className="ws-nav" aria-current={onForms ? 'page' : undefined}>
          <Icon name="book" />
          <span>{isSuperAdmin(user) ? 'Process forms' : 'My process forms'}</span>
          {formCount != null && <span className="ws-count">{formCount}</span>}
        </Link>
        <Link href={`/w/${dept.id}/sheets`} className="ws-nav" aria-current={onSheets ? 'page' : undefined}>
          <Icon name="table" />
          <span>{isSuperAdmin(user) ? 'Spreadsheets' : 'My spreadsheets'}</span>
          <span className="ws-count">{sheetCount}</span>
        </Link>
        <span className={`keap-pill${keapOn ? '' : ' off'}`}>{keapOn ? 'Keap connected' : 'Keap not connected'}</span>
      </div>
    </aside>
  );
}
