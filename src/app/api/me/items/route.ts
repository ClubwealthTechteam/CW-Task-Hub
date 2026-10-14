// The signed-in person's urgent tasks and to-do list (home page). Only ever their own.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { addItem, listItems, removeItems, updateItem } from '@/lib/home/items';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  return NextResponse.json({ items: await listItems(user.id) });
}

/** Add: { kind: 'urgent' | 'hot' | 'todo', text, due? } */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  try {
    const item = await addItem(user.id, await req.json().catch(() => ({})));
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Change one: { id, done?, text?, due?, kind? } */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const item = await updateItem(user.id, String(body.id ?? ''), body);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ item });
}

/** Remove: { ids: [...] } */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 200) : [];
  await removeItems(user.id, ids);
  return NextResponse.json({ ok: true });
}
