import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canLookUpKeap } from '@/lib/integrations/keap/access';
import { contactWithTags, keapMessage } from '@/lib/integrations/keap/contacts';
import { KeapError } from '@/lib/integrations/keap/client';

export const dynamic = 'force-dynamic';

/** One Keap contact with their tags. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!canLookUpKeap(user)) return NextResponse.json({ error: 'None of your tasks use Keap' }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json({ contact: await contactWithTags(id) });
  } catch (e) {
    const err = e as KeapError;
    if (err.status === 404) return NextResponse.json({ error: 'Contact not found in Keap' }, { status: 404 });
    return NextResponse.json({ error: keapMessage(err) }, { status: 502 });
  }
}
