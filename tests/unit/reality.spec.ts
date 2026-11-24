// REality intro emails: the rows the routine sends, the email the page previews, and the batch steps.
import { expect, test } from '@playwright/test';
import { approveBatch, canUseReality, claimBatch, cleanRows, createBatch, findBatch, recordResults } from '../../src/lib/reality/batches';
import { realityEmail } from '../../src/lib/reality/email';
import { setJSON } from '../../src/lib/store';
import type { Person } from '../../src/config/people';

const am = { id: 'amrissa', name: 'Amrissa', role: 'member', departments: ['admin'] } as Person;
const miguel = { id: 'miguel', name: 'Miguel Ababon', role: 'super_admin', departments: ['tech'] } as Person;
const liz = { id: 'liz', name: 'Liz', role: 'member', departments: ['events'] } as Person;
const row = (n: number, extra = {}) => ({ row: n, keapId: String(900000 + n), first: `First${n}`, last: 'Last', email: `p${n}@example.com`, location: 'Arnold, MD', ...extra });

test.beforeEach(async () => { await setJSON('reality:batches', []); });

test('only Am and super admins use the REality page', () => {
  expect(canUseReality(am)).toBe(true);
  expect(canUseReality(miguel)).toBe(true);
  expect(canUseReality(liz)).toBe(false);
  expect(canUseReality(null)).toBe(false);
});

test('rows are checked before a batch is made', () => {
  expect('people' in cleanRows([row(5)])).toBe(true);
  expect(cleanRows([])).toEqual({ error: expect.any(String) });
  expect('error' in cleanRows([row(5, { email: 'a@b.com, c@d.com' })])).toBe(true);
  expect('error' in cleanRows([row(5, { keapId: 'abc' })])).toBe(true);
  expect('error' in cleanRows([row(5), row(5)])).toBe(true);
  expect('error' in cleanRows(Array.from({ length: 51 }, (_, i) => row(i + 2)))).toBe(true);
});

test('the email is Am’s template with names escaped', () => {
  const e = realityEmail('<b>Jo</b>', 'Arnold, MD');
  expect(e.subject).toBe('Intro to REality (Recruiting)');
  expect(e.html).toContain('Hi &lt;b&gt;Jo&lt;/b&gt;,');
  expect(e.html).toContain('I have you attended one of our recent Half-Day Events with Michael in Arnold, MD');
  expect(e.text).toContain('Mona - mona@realestatestatistics.com');
});

test('one open batch at a time; approve, claim once, record results', async () => {
  const clean = cleanRows([row(2), row(3), row(4)]);
  if ('error' in clean) throw new Error(clean.error);
  const made = await createBatch(clean.people);
  if ('error' in made) throw new Error('not made');
  expect('error' in (await createBatch(clean.people))).toBe(true);

  expect('error' in (await approveBatch(made.batch.id, am, [2, 3, 4]))).toBe(true);
  const ok = await approveBatch(made.batch.id, am, [3]);
  if ('error' in ok) throw new Error(ok.error);
  expect(ok.batch.people.map((p) => p.status)).toEqual(['waiting', 'left out', 'waiting']);
  expect('error' in (await approveBatch(made.batch.id, am, []))).toBe(true);

  expect('error' in (await claimBatch(made.batch.id))).toBe(false);
  expect('error' in (await claimBatch(made.batch.id))).toBe(true);

  await recordResults(made.batch.id, [{ row: 2, status: 'sent' }, { row: 3, status: 'sent' }, { row: 4, status: 'skipped', note: 'Email doesn’t match Keap' }], true, { sent: true, count: 1, leftOut: [] });
  const b = await findBatch(made.batch.id);
  expect(b?.status).toBe('done');
  expect(b?.people.map((p) => p.status)).toEqual(['sent', 'left out', 'skipped']);
  expect(b?.list).toEqual({ sent: true, count: 1, leftOut: [] });
});
