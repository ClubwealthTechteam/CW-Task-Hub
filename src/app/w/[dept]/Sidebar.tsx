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
  onSheets?: boolean;
}

export function Sidebar({ user, dept, tasks, selectedId, sheetCount, onSheets }: Props) {
  const mine = tasks.filter((a) => a.ownerId === user.id);
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
        {mine.length > 0 && (<><div className="ws-group">My tasks</div>{mine.map(navItem)}</>)}
        {[...byOwner].map(([id, list]) => (
          <div key={id} className="ws-navs">
            <div className="ws-group">{personById(id)?.name.split(/\s+/)[0] ?? id}&apos;s tasks</div>
            {list.map(navItem)}
          </div>
        ))}
        {tasks.length === 0 && <p className="ws-empty">{isSuperAdmin(user) ? 'No tasks in this department yet.' : 'You don’t have any tasks yet. Ask Miguel to add yours from the AI audit.'}</p>}
      </nav>
      <div className="ws-side-f">
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
