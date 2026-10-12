import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';
import { findAutomation } from '@/data/catalog';
import { newId } from '@/lib/chat/store';
import {
  accountAllowed, isEmail, listApproved, listSheets, mainAccount, normalizeEmail, saveSheets, sheetIdFromUrl, type SheetEntry,
} from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const MAX_PER_PERSON = 100;

/** Your spreadsheets (super admins: everyone's, plus the approved external accounts). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const all = await listSheets();
  const admin = isSuperAdmin(user);
  return NextResponse.json({
    sheets: admin ? all : all.filter((s) => s.owner === user.id),
    approved: admin ? await listApproved() : undefined,
    mainAccount: mainAccount(),
  });
}

/** Adds a spreadsheet: { name, url, account? (default: the marketing Gmail), taskIds?, note? }. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? '').trim().slice(0, 120);
  const url = String(body.url ?? '').trim();
  const account = normalizeEmail(String(body.account ?? '') || mainAccount());
  const note = String(body.note ?? '').trim().slice(0, 500) || undefined;
  const taskIds = Array.isArray(body.taskIds) ? [...new Set(body.taskIds.map(String))] as string[] : [];

  if (!name) return NextResponse.json({ error: 'Give the spreadsheet a name' }, { status: 400 });
  const sheetId = sheetIdFromUrl(url);
  if (!sheetId) return NextResponse.json({ error: 'Paste a Google Sheets link (it starts with https://docs.google.com/spreadsheets/d/…)' }, { status: 400 });
  if (!isEmail(account)) return NextResponse.json({ error: `Enter the Google account the sheet is in, e.g. ${mainAccount()}` }, { status: 400 });
  if (!(await accountAllowed(account))) {
    return NextResponse.json({
      error: `${account} isn’t approved. Spreadsheets need to be in the marketing Gmail (${mainAccount()}): move or share it there, or ask Miguel to approve this account.`,
    }, { status: 403 });
  }
  for (const id of taskIds) {
    const a = await findAutomation(id);
    if (!a || !canViewAutomation(user, a)) return NextResponse.json({ error: 'One of the tasks wasn’t found' }, { status: 400 });
  }

  const all = await listSheets();
  if (all.filter((s) => s.owner === user.id).length >= MAX_PER_PERSON) {
    return NextResponse.json({ error: `You can list up to ${MAX_PER_PERSON} spreadsheets` }, { status: 400 });
  }
  if (all.some((s) => s.owner === user.id && s.sheetId === sheetId)) {
    return NextResponse.json({ error: 'You’ve already added this spreadsheet' }, { status: 409 });
  }
  const entry: SheetEntry = { id: newId('s'), owner: user.id, name, url, sheetId, account, taskIds, note, added: Date.now() };
  await saveSheets([entry, ...all]);
  return NextResponse.json({ sheet: entry });
}
