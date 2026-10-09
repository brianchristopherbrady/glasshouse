import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const ADMIN_TOKEN = 'e2e-bootstrap-admin-token';
const TOKEN_KEY = 'glasshouse-api-token';
const admin = { Authorization: `Bearer ${ADMIN_TOKEN}` };

async function signInWith(page: Page, token: string) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key!, value!),
    [TOKEN_KEY, token],
  );
}

async function seededRunWithDiff(request: APIRequestContext) {
  const repos = await (await request.get('/api/repositories', { headers: admin })).json();
  const repo = repos.find((r: { fullName: string }) => r.fullName === 'acme/payments');
  const runs = await (
    await request.get(`/api/repositories/${repo.id}/runs`, { headers: admin })
  ).json();
  for (const run of runs) {
    const files = await (await request.get(`/api/runs/${run.id}/files`, { headers: admin })).json();
    const withDiff = files.find((f: { diff: string | null }) => f.diff);
    if (withDiff)
      return {
        repoId: repo.id as string,
        runId: run.id as string,
        file: withDiff as { path: string },
      };
  }
  throw new Error('seed has no run with a diff');
}

// Any CSP violation means the security headers would break the real UI.
test.beforeEach(({ page }) => {
  page.on('console', (msg) => {
    if (/Content[- ]Security[- ]Policy/i.test(msg.text()))
      throw new Error(`CSP violation: ${msg.text()}`);
  });
});

test('requires a valid token before showing any data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to Agentic Flows' })).toBeVisible();

  await page.getByLabel('API token').fill('af_not-a-real-token');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That token was not accepted.');

  await page.getByLabel('API token').fill(ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('combobox', { name: 'Select repository' })).toHaveValue(/.+/);
  await expect(page).toHaveURL(/\/repos\/[^/]+$/);

  await page.getByRole('button', { name: /^Sign out/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Agentic Flows' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
});

test('serves the UI with strict security headers', async ({ request }) => {
  const res = await request.get('/repos/anything');
  expect(res.status()).toBe(200);
  const csp = res.headers()['content-security-policy'];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self' 'sha256-/);
  expect(res.headers()['x-frame-options']).toBe('DENY');
});

test("shows a run's changed files with expandable diffs", async ({ page, request }) => {
  const { repoId, runId, file } = await seededRunWithDiff(request);
  await signInWith(page, ADMIN_TOKEN);
  await page.goto(`/repos/${repoId}/runs/${runId}`);

  await page.getByRole('tab', { name: /Changed files/ }).click();
  await expect(page).toHaveURL(/tab=files/);
  await expect(page.getByRole('heading', { name: /files? changed/ })).toBeVisible();

  const row = page.getByRole('button', {
    name: new RegExp(file.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  });
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('pre').first()).toContainText('@@');

  // Deep link straight to the section.
  await page.goto(`/repos/${repoId}/runs/${runId}?tab=files`);
  await expect(page.getByRole('tab', { name: /Changed files/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('renders a nested trace and the architecture graph', async ({ page, request }) => {
  const { repoId, runId } = await seededRunWithDiff(request);
  await signInWith(page, ADMIN_TOKEN);
  await page.goto(`/repos/${repoId}/runs/${runId}`);
  await expect(page.getByRole('tab', { name: 'Trace' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/agent/i).first()).toBeVisible();

  await page.goto(`/repos/${repoId}/architecture`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  expect(await page.locator('.react-flow__node').count()).toBeGreaterThan(3);
});

test('admin can issue and revoke a token; a viewer token is read-only', async ({
  page,
  request,
}) => {
  const { repoId } = await seededRunWithDiff(request);
  await signInWith(page, ADMIN_TOKEN);
  await page.goto(`/repos/${repoId}/settings`);

  await page.getByLabel('Name').fill('e2e viewer');
  await page.getByLabel('Role').selectOption('viewer');
  await page.getByRole('button', { name: 'Create token' }).click();
  const viewerToken = (await page.getByTestId('new-token').textContent())?.trim() ?? '';
  expect(viewerToken).toMatch(/^af_/);

  const viewerRes = await request.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  expect(await viewerRes.json()).toMatchObject({ role: 'viewer', name: 'e2e viewer' });
  const forbidden = await request.post('/api/tokens', {
    headers: { Authorization: `Bearer ${viewerToken}` },
    data: { name: 'x', role: 'admin' },
  });
  expect(forbidden.status()).toBe(403);

  const viewerPage = await page.context().browser()!.newPage();
  await signInWith(viewerPage, viewerToken);
  await viewerPage.goto(`/repos/${repoId}/settings`);
  await expect(viewerPage.getByText('Your role is read-only.')).toBeVisible();
  await viewerPage.close();

  await page.getByRole('button', { name: 'Revoke token e2e viewer' }).click();
  await expect(page.getByRole('row', { name: /e2e viewer/ })).toContainText('Revoked');
  const revoked = await request.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  expect(revoked.status()).toBe(401);
});
