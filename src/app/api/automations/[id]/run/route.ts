import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { findAutomation } from '@/data/catalog';
import { canViewAutomation } from '@/lib/access';
import { runAutomation } from '@/lib/automations/runner';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const a = await findAutomation(params.id);
  if (!a || !canViewAutomation(user, a)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const input = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await runAutomation(a.id, input, user));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
