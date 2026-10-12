import { redirect } from 'next/navigation';

// Departments now open as workspaces.
export default function DepartmentPage({ params }: { params: { dept: string } }) {
  redirect(`/w/${params.dept}`);
}
