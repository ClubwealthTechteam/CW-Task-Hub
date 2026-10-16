// Smoke tests for the main flows. They catch pages that crash, sign-in and access rules that break,
// and the home page tools that stop saving.
import { expect, test, type Page } from '@playwright/test';

const CODE = 'smoke-test-code';

async function signIn(page: Page, personId: string) {
  await page.addInitScript(() => { try { localStorage.setItem('cw-tour-done', '1'); } catch { /* ignore */ } });
  const res = await page.request.post('/api/auth/login', { data: { personId, accessCode: CODE } });
  expect(res.ok()).toBeTruthy();
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('signed-out people are sent to the login page, and APIs refuse them', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get('/api/chat')).status()).toBe(401);
  expect((await request.get('/api/me/items')).status()).toBe(401);
  const health = await (await request.get('/api/health')).json();
  expect(health.ok).toBe(true);
});

test('a wrong access code is refused', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { personId: 'jaymar', accessCode: 'nope' } });
  expect(res.status()).toBe(401);
});

test('team members only have EOD reports for now: other pages send them there, the rest of the menu is greyed out', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, 'jaymar');
  for (const path of ['/', '/w/social-media', '/w/events', '/updates', '/help', '/keap']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/eod$/);
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My EOD report');
  const soon = page.locator('.soon', { hasText: 'My workspace' });
  await expect(soon).toHaveAttribute('aria-disabled', 'true');
  await expect(soon).toHaveAttribute('data-tip', 'This feature will be available soon');
  await expect(page.locator('.cwa-bubble')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('team members cannot open other departments or the team EOD feed', async ({ page }) => {
  await signIn(page, 'jaymar');
  await page.goto('/w/events');
  await expect(page).toHaveURL(/\/eod$/);
  expect((await page.request.get('/api/eod?feed=1')).status()).toBe(404);
});

test('super admin overview shows adoption and errors', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, 'miguel');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team adoption' })).toBeVisible();
  await expect(page.getByText('Errors · last 24 hours')).toBeVisible();
  for (const path of ['/w/events', '/w/client-care', '/w/social-media', '/w/admin', '/updates', '/help', '/council', '/admin/integrations', '/admin/updates']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator('.topbar')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('backup refuses requests without the secret', async ({ request }) => {
  expect([403, 503]).toContain((await request.get('/api/backup')).status());
});

test('EOD report: a team member submits it and a super admin sees it in the feed', async ({ browser }) => {
  const member = await browser.newPage();
  const errors = watchErrors(member);
  await signIn(member, 'ali');
  await member.goto('/eod');
  await expect(member.getByRole('heading', { level: 1 })).toHaveText('My EOD report');
  // Paste from an EOD sheet (Time column + a day column), then fix one row by hand.
  await member.getByLabel('Paste your EOD sheet').fill('Time\tThursday\n6:30 AM\tPrepared shift log\n7:00 AM\tConnected Keap\n7:30 AM\tDAILY HUDDLE\n8:00 AM\t');
  await expect(member.getByText('Found 3 tasks')).toBeVisible();
  await member.getByRole('button', { name: 'Use these 3 tasks' }).click();
  await expect(member.getByLabel('Row 3 task')).toHaveValue('DAILY HUDDLE');
  await member.getByRole('tab', { name: 'Type it in' }).click();
  await member.getByLabel('Row 1 task').fill('Smoke test DHR pulls');
  await member.getByLabel('Row 1 notes').fill('Pulled and reviewed numbers');
  await member.getByLabel('Row 1: I do this every day').check();
  await expect(member.getByText('Draft saved')).toBeVisible();
  await member.getByRole('button', { name: 'Submit EOD report' }).click();
  // Submitting clears the form for the next report; the sent one stays under My reports.
  await expect(member.getByRole('status')).toContainText('was submitted');
  await expect(member.getByLabel('Paste your EOD sheet')).toHaveValue('');
  await member.reload();
  await expect(member.getByLabel('Paste your EOD sheet')).toBeVisible();
  expect(errors).toEqual([]);

  const admin = await browser.newPage();
  await signIn(admin, 'miguel');
  await admin.goto('/eod');
  await expect(admin.getByRole('heading', { level: 1 })).toHaveText('Team EOD reports');
  await admin.getByRole('button', { name: /Ali-Ace Berico/ }).click();
  await expect(admin.getByRole('cell', { name: /Smoke test DHR pulls/ })).toBeVisible();
  await admin.getByRole('button', { name: 'Find automation ideas' }).click();
  await expect(admin.locator('#cwa-input')).toHaveValue(/EOD report/);

  // Super admins fill in their own report too.
  await admin.getByRole('tab', { name: 'My EOD report' }).click();
  await admin.getByRole('tab', { name: 'Type it in' }).click();
  await admin.getByLabel('Row 1 task').fill('Smoke test admin task');
  await admin.getByRole('button', { name: 'Submit EOD report' }).click();
  await expect(admin.getByRole('status')).toContainText('was submitted');
  await admin.getByRole('tab', { name: 'Team reports' }).click();
  await expect(admin.getByRole('button', { name: /Miguel Ababon/ })).toBeVisible();

  // Only Miguel can delete a report; it disappears from the feed.
  const other = await browser.newPage();
  await signIn(other, 'omerson');
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  expect((await other.request.delete(`/api/eod?id=ali:${day}`)).status()).toBe(403);
  await admin.getByRole('button', { name: /Ali-Ace Berico/ }).click();
  await admin.getByRole('button', { name: 'Delete report' }).click();
  await admin.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(admin.getByRole('button', { name: /Ali-Ace Berico/ })).toHaveCount(0);
});
