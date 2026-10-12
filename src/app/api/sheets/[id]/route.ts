import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { listSheets, saveSheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

/** Removes a spreadsheet you added (super admins: anyone's). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const all = await listSheets();
  const sheet = all.find((s) => s.id === params.id);
  if (!sheet || (sheet.owner !== user.id && !isSuperAdmin(user))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await saveSheets(all.filter((s) => s.id !== sheet.id));
  return NextResponse.json({ ok: true });
}
