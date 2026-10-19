import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test against the dev server. The API is mocked through page.route with the real
 * envelope shapes, so no backend is needed.
 */
async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/system')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { closed_deployment: true, organization: { name: 'Smith & Co', slug: 'smith' } },
          message: null,
          meta: null,
        }),
      });
      return;
    }
    // No session: the silent refresh on load (and anything else) answers 401.
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: { 'X-Request-ID': 'e2e-refresh' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'AUTH_REFRESH_INVALID',
          message: 'Please sign in again.',
          details: null,
          request_id: 'e2e-refresh',
        },
      }),
    });
  });
}

test('an anonymous visitor lands on the login page, which validates', async ({ page }) => {
  await mockApi(page);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Capium Time & Fees').first()).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your email address')).toBeVisible();
  await expect(page.getByText('Enter your password')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
});

test('a practice route sends an anonymous visitor to login with a return path', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/smith/settings/staff');
  await expect(page).toHaveURL(/\/login\?next=%2Fsmith%2Fsettings%2Fstaff$/);
});
