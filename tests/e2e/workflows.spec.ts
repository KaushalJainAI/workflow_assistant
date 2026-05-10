/**
 * Workflows e2e — golden path + a couple of adversarial probes.
 * Uses an authenticated session built via API to skip the login UI.
 */
import { expect, request, test } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:8000';

async function freshLogin() {
  const ctx = await request.newContext();
  const id = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e_${id}@example.com`;
  const password = 'Sup3r$ecret-e2e!';
  await ctx.post(`${API}/api/auth/register/`, {
    data: { username: `e2e_${id}`, email, password, password2: password },
  });
  const r = await ctx.post(`${API}/api/auth/login/`, { data: { email, password } });
  if (!r.ok()) throw new Error(`login failed ${r.status()}`);
  const body = await r.json();
  return body.access ?? body.access_token;
}

test('user can create a new workflow from the sidebar', async ({ page }) => {
  const token = await freshLogin();
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t);
  }, token);
  await page.goto('/workflows');

  await page.getByRole('button', { name: /new workflow/i }).click();
  await expect(page).toHaveURL(/\/workflow\/\d+/, { timeout: 10_000 });
});

test('reload on a workflow URL preserves the page (no logout flicker)', async ({ page }) => {
  const token = await freshLogin();
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t);
  }, token);
  await page.goto('/workflows');
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
});

test('navigating to bogus workflow id does not break the app', async ({ page }) => {
  const token = await freshLogin();
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t);
  }, token);
  await page.goto('/workflow/9999999');
  // Either a 404 / not-found state or a redirect — but no white screen of death.
  await expect(page.locator('body')).not.toBeEmpty();
});
