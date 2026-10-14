import { redirect } from 'next/navigation';

// Departments now open as workspaces.
export default async function DepartmentPage(props: { params: Promise<{ dept: string }> }) {
  const params = await props.params;
  redirect(`/w/${params.dept}`);
}
