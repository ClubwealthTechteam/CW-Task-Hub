// Spreadsheet contents for the assistant (read-only): the sheets linked to the task being chatted about, or, in
// general chats, the person's sheets named in the message. Kept small: first tabs and rows only.

import type { Person } from '@/config/people';
import { listSheets } from '@/lib/sheets';
import { readSheet, sheetsConfigured } from '@/lib/integrations/google/sheets';

const MAX_SHEETS = 2;
const MAX_CHARS = 12_000;
const BUDGET_MS = 7000;

export async function sheetsContext(user: Person, message: string, taskId?: string): Promise<string> {
  if (!sheetsConfigured()) return '';
  const mine = (await listSheets()).filter((s) => s.owner === user.id);
  const text = message.toLowerCase();
  const picked = (taskId ? mine.filter((s) => s.taskIds.includes(taskId)) : [])
    .concat(mine.filter((s) => text.includes(s.name.toLowerCase())))
    .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i)
    .slice(0, MAX_SHEETS);
  if (!picked.length) return '';

  const read = Promise.all(picked.map(async (s) => {
    try {
      const c = await readSheet(s.sheetId);
      const tabs = c.tabs.map((t) => `  tab "${t.title}":\n${t.rows.map((r) => `    ${r.join(' | ')}`).join('\n') || '    (empty)'}`).join('\n');
      return `SHEET "${s.name}" (${c.title}):\n${tabs}${c.truncated ? '\n  (more tabs not shown)' : ''}`;
    } catch (e) {
      return `SHEET "${s.name}": couldn't be read (${(e as Error).message})`;
    }
  }));
  const timeout = new Promise<string[]>((resolve) => setTimeout(() => resolve(['(the spreadsheets took too long to read and were skipped)']), BUDGET_MS));
  const blocks = (await Promise.race([read, timeout])).join('\n\n').slice(0, MAX_CHARS);
  return `\n\nFROM GOOGLE SHEETS (their own spreadsheets, read just now, read-only; first rows only):\n${blocks}`;
}
