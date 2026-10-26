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

test('the SOP Handbook is open to team members: index, an article, the POC log and the out switch', async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page, 'ali');
  await page.goto('/sop');
  await expect(page).toHaveURL(/\/sop$/);
  await expect(page.getByRole('link', { name: 'SOP Handbook' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'I’m out today' }).click();
  await expect(page.locator('tr', { hasText: 'EV-01' }).getByText('Out today')).toBeVisible();
  await page.getByRole('button', { name: 'I’m back' }).click();
  await page.getByRole('link', { name: 'EV-01' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Half-Day Event attendance tagging');
  for (const label of ['SOP Name', 'Effective Date', 'Effective Period', 'Audience Using SOP', 'Exemptions', 'Owner', 'Last Review Date']) {
    await expect(page.locator('.sop-meta th', { hasText: label })).toBeVisible();
  }
  for (const h of ['Prerequisites', 'Additional Information', 'Steps', 'References']) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Contents' }).getByRole('link', { name: 'Step 3', exact: true })).toHaveAttribute('href', '#step-3');
  // Two-way steps show both paths, each with a link to the step to continue with.
  const matched = page.locator('#step-6');
  await expect(matched.getByText('Did each person match a registration?')).toBeVisible();
  await expect(matched.getByRole('region', { name: 'If PHONE_EXACT or NAME_EXACT' }).getByRole('link', { name: /Next: go to step 9/ })).toHaveAttribute('href', '#step-9');
  await expect(matched.getByRole('region', { name: 'If NO_REGISTRATION_MATCH' }).getByRole('link', { name: /Next: go to step 7/ })).toHaveAttribute('href', '#step-7');
  await page.getByLabel('What was done').fill('Smoke test log row');
  await page.getByRole('button', { name: 'Add log row' }).click();
  await expect(page.locator('.sop-log')).toContainText('Smoke test log row');
  expect((await page.request.post('/api/sop/log', { data: { id: 'XX-99', what: 'x' } })).status()).toBe(404);
  expect(errors).toEqual([]);
});

test('only Miguel can paste a step screenshot on an SOP article; everyone signed in sees it', async ({ page, browser }) => {
  const errors = watchErrors(page);
  await signIn(page, 'miguel');
  await page.goto('/sop/EV-01');
  await expect(page.locator('.sop-paste')).toHaveCount(20);
  // A 2x2 PNG, pasted into step 3's box the way a screenshot would be.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';
  const box = page.getByRole('button', { name: 'Paste a screenshot for step 3' });
  await box.focus();
  await box.evaluate(async (el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, png);
  const img = page.locator('img[alt="EV-01 step 3"]');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect((await page.request.get(src as string)).headers()['content-type']).toMatch(/^image\//);

  const ali = await browser.newPage();
  await signIn(ali, 'ali');
  await ali.goto('/sop/EV-01');
  await expect(ali.locator('img[alt="EV-01 step 3"]')).toBeVisible();
  await expect(ali.locator('.sop-paste')).toHaveCount(0);
  expect((await ali.request.post('/api/sop/shot', { data: { id: 'EV-01', step: 3, dataUrl: `data:image/png;base64,${png}` } })).status()).toBe(403);
  await ali.close();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('img[alt="EV-01 step 3"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the hub is desktop only: on a phone a signed-in person sees "Admin Hub viewable in desktop only"', async ({ browser }) => {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto('/login');
  await expect(phone.getByText('Admin Hub viewable in desktop only')).toBeHidden();
  await signIn(phone, 'ali');
  await phone.goto('/sop/EV-01');
  await expect(phone.getByText('Admin Hub viewable in desktop only')).toBeVisible();
  await expect(phone.getByRole('heading', { level: 1 })).toBeHidden();
  await phone.setViewportSize({ width: 1440, height: 900 });
  await expect(phone.getByText('Admin Hub viewable in desktop only')).toBeHidden();
  await expect(phone.getByRole('heading', { level: 1 })).toBeVisible();
  await phone.close();
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
  await member.getByLabel('How many tasks have you completed?').fill('9');
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
  await expect(admin.getByText('9 tasks completed', { exact: false })).toBeVisible();
  await admin.getByRole('button', { name: 'Find automation ideas' }).click();
  await expect(admin.locator('#cwa-input')).toHaveValue(/EOD report/);

  // Super admins fill in their own report too.
  await admin.getByRole('tab', { name: 'My EOD report' }).click();
  await admin.getByRole('tab', { name: 'Type it in' }).click();
  await admin.getByLabel('Row 1 task').fill('Smoke test admin task');
  await admin.getByLabel('How many tasks have you completed?').fill('4');
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
