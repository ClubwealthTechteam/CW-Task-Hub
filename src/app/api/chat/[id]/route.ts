import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { getConversation } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const conv = await getConversation(params.id);
  if (!conv || (conv.owner !== user.id && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  return NextResponse.json({ conversation: conv });
}
