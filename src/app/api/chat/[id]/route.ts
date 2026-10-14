import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { deleteConversation, getConversation } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const conv = await getConversation(params.id);
  if (!conv || (conv.owner !== user.id && !isSuperAdmin(user))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  return NextResponse.json({ conversation: conv });
}

/** Removes one of your own chats. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const conv = await getConversation(params.id);
  if (!conv || conv.owner !== user.id) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  await deleteConversation(conv);
  return NextResponse.json({ ok: true });
}
