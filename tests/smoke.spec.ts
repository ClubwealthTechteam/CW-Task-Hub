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

test('team member home: lists save, search finds tasks, workspace opens', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, 'jaymar');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Jay');
  await expect(page.locator('.brand span')).toHaveText('ADMIN HUB');

  await page.fill('#hm-urgent-text', 'Smoke test urgent item');
  await page.press('#hm-urgent-text', 'Enter');
  await page.fill('#hm-todo-text', 'Smoke test to-do');
  await page.press('#hm-todo-text', 'Enter');
  await expect(page.locator('.hm-item', { hasText: 'Smoke test urgent item' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.hm-item', { hasText: 'Smoke test to-do' })).toBeVisible();
  await page.getByLabel('Mark done: Smoke test to-do').click(); // done items leave the list
  await expect(page.locator('.hm-item', { hasText: 'Smoke test to-do' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search' }).fill('welcome');
  await expect(page.getByRole('option', { name: /New Client Welcome Posts/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/w\/social-media\?t=/);

  await page.locator('.bell-btn').click();
  await expect(page.getByRole('menu', { name: 'Notifications' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('team members cannot open other departments', async ({ page }) => {
  await signIn(page, 'jaymar');
  const res = await page.goto('/w/events');
  expect(res?.status()).toBe(404);
});

test('super admin overview shows adoption and errors', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, 'miguel');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team adoption' })).toBeVisible();
  await expect(page.getByText('Errors · last 24 hours')).toBeVisible();
  for (const path of ['/w/events', '/w/client-care', '/w/social-media', '/w/admin', '/updates', '/help', '/council', '/integrations']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator('.topbar')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('backup refuses requests without the secret', async ({ request }) => {
  expect([403, 503]).toContain((await request.get('/api/backup')).status());
});
