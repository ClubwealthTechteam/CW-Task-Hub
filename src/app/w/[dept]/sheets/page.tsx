import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireDepartment } from '@/lib/auth/current-user';
import { departmentById, type DepartmentId } from '@/config/departments';
import { personById } from '@/config/people';
import { automationsFor } from '@/data/automations';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { listApproved, listSheets, mainAccount } from '@/lib/sheets';
import { Sidebar } from '../Sidebar';
import { SheetsManager } from './SheetsManager';

export const dynamic = 'force-dynamic';

export default async function SheetsPage({ params, searchParams }: { params: { dept: string }; searchParams: { task?: string } }) {
  const dept = departmentById(params.dept);
  if (!dept) notFound();
  const user = await requireDepartment(dept.id as DepartmentId);
  const admin = isSuperAdmin(user);
  const tasks = automationsFor(dept.id).filter((a) => canViewAutomation(user, a));
  const sheets = (await listSheets()).filter((s) => (admin
    ? s.owner === user.id || personById(s.owner)?.departments.includes(dept.id as DepartmentId)
    : s.owner === user.id));

  return (
    <>
      <Header user={user} current={dept.id} />
      <div className="ws ws-wide">
        <Sidebar user={user} dept={dept} tasks={tasks} sheetCount={sheets.length} onSheets />
        <SheetsManager
          admin={admin}
          deptName={dept.name}
          mainAccount={mainAccount()}
          approved={(await listApproved()).map((a) => ({ email: a.email, note: a.note }))}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title, owner: t.ownerId === user.id ? null : personById(t.ownerId)?.name.split(/\s+/)[0] ?? null }))}
          initial={sheets.map((s) => ({ ...s, ownerName: personById(s.owner)?.name ?? s.owner }))}
          preselect={tasks.some((t) => t.id === searchParams.task) ? searchParams.task : undefined}
        />
      </div>
    </>
  );
}
