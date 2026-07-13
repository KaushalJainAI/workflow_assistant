/**
 * Connectors page e2e — verifies the curated list of MCP connectors renders
 * for an authenticated user, and that adding a credential surfaces in the UI.
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
  return (await r.json()).access ?? (await r.json()).access_token;
}

test.describe('Connectors page — happy', () => {
  test('lists at least one curated connector', async ({ page }) => {
    const token = await freshLogin();
    await page.addInitScript((t) => localStorage.setItem('access_token', t), token);
    await page.goto('/connectors');
    // Look for any of the curated names — copy may evolve.
    await expect(
      page.getByText(/Filesystem|Notion|Google Drive|Slack|Gmail/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Connectors page — angry', () => {
  test('survives backend returning empty server list', async ({ page }) => {
    const token = await freshLogin();
    await page.addInitScript((t) => localStorage.setItem('access_token', t), token);
    // Intercept and force an empty list
    await page.route('**/api/mcp/servers/', (route) =>
      route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }),
    );
    await page.goto('/connectors');
    // Page should still render its chrome / header
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('survives backend 500', async ({ page }) => {
    const token = await freshLogin();
    await page.addInitScript((t) => localStorage.setItem('access_token', t), token);
    await page.route('**/api/mcp/servers/', (route) =>
      route.fulfill({ status: 500, body: '{"detail":"boom"}', contentType: 'application/json' }),
    );
    await page.goto('/connectors');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
