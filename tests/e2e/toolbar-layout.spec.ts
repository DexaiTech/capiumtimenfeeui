import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * TOOLBAR-01 layout check of the list toolbars (`PageToolbar`) at laptop, tablet and zoom widths.
 * Opt-in and local only: it needs a running API with a seeded practice (at least one invoice,
 * job, claim, lead, time entry, payment and credit note) and an Owner login.
 *
 *   TOOLBAR_LAYOUT=1 TOOLBAR_ORG=<practice slug> TOOLBAR_EMAIL=<owner email> \
 *   TOOLBAR_PASSWORD=<password> npx playwright test toolbar-layout --project=desktop --workers=1
 *
 * Browser zoom is simulated with the same CSS width: viewport = window / zoom and
 * deviceScaleFactor = zoom. Each run's measurements are attached to the report as JSON.
 *
 * Each test signs in again (25 sign-ins), above the API's 5 per account per 15 minutes: start the
 * local API with `AUTH_RATE_LIMIT_FACTOR=10` (refused in production).
 */

const ORG = process.env.TOOLBAR_ORG ?? '';
const EMAIL = process.env.TOOLBAR_EMAIL ?? '';
const PASSWORD = process.env.TOOLBAR_PASSWORD ?? '';

const PAGES = [
  { name: 'Invoices', path: 'billing/invoices' },
  { name: 'Jobs', path: 'jobs' },
  { name: 'My Expenses', path: 'expenses/mine' },
  { name: 'Expense Claims', path: 'expenses' },
  { name: 'Leads', path: 'clients/leads' },
  { name: 'Time entries', path: 'time/entries' },
  { name: 'Staff', path: 'team/staff' },
  { name: 'Credit notes', path: 'billing/credit-notes' },
  { name: 'Payments', path: 'billing/payments' },
] as const;

const WINDOWS = [1920, 1600, 1440, 1366, 1280, 1024, 768] as const;
const ZOOMS = [0.9, 1, 1.1] as const;
/** `@6xl/toolbar`: below this inner toolbar width Show/Hide Columns and Export are icon-only. */
const COMPACT_BELOW_PX = 72 * 16;

// Each test visits every page above: give it more than the default 30 s. Run with --workers=1;
// not serial, so one failing width doesn't hide the others.
test.describe.configure({ timeout: 300_000 });
test.skip(!process.env.TOOLBAR_LAYOUT, 'Layout check: set TOOLBAR_LAYOUT=1 (see the file header).');

/**
 * Known exception (same on `main`, not TOOLBAR-01): Time entries puts a `DateRangeField` of fixed
 * width (`sm:w-80`) in the search slot, and that field always stacks its quick ranges under the
 * dates: 2 rows more than the toolbar layout itself. Changing that control is a separate ticket.
 */
const EXTRA_ROWS: Partial<Record<string, number>> = { 'Time entries': 2 };

/** One row expected on every laptop width and at 1024 @ 90 %; at most two rows below. */
const maxRows = (width: number, zoom: number, page?: string) =>
  (width >= 1280 || (width === 1024 && zoom < 1) ? 1 : 2) + (EXTRA_ROWS[page ?? ''] ?? 0);

async function signedInPage(
  browser: Browser,
  baseURL: string | undefined,
  width: number,
  zoom: number,
  collapsed = false,
) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: Math.round(width / zoom), height: Math.round(900 / zoom) },
    deviceScaleFactor: zoom,
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  if (collapsed) {
    await page.goto(`/${ORG}/jobs`);
    // Wait for the shell: `isVisible()` doesn't wait, and a missed click leaves the sidebar open.
    const toggle = page.getByRole('button', { name: 'Collapse the sidebar' });
    await toggle.click({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Expand the sidebar' })).toBeVisible();
  }
  return page;
}

interface Measure {
  rows: number;
  pageOverflow: boolean;
  toolbarOverflow: boolean;
  innerWidth: number;
  tabsOverflow: boolean;
  searchWidth: number | null;
  compactLabels: Array<{ name: string; hidden: boolean }>;
}

function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>('main [data-page-toolbar]');
    if (!toolbar) throw new Error('No [data-page-toolbar] on the page');
    const tablist = toolbar.querySelector<HTMLElement>('[role=tablist]');
    const controls = [
      ...toolbar.querySelectorAll<HTMLElement>(
        'input, select, a, button:not([role=tab]):not([aria-hidden=true]), h2',
      ),
    ].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !tablist?.contains(element);
    });
    const centres: number[] = [];
    for (const element of [...(tablist ? [tablist] : []), ...controls]) {
      const rect = element.getBoundingClientRect();
      const centre = rect.top + rect.height / 2;
      if (!centres.some((value) => Math.abs(value - centre) <= 8)) centres.push(centre);
    }
    const search = toolbar.querySelector<HTMLElement>('input[type=search]');
    const innerWidth = toolbar.clientWidth - 16;
    return {
      rows: centres.length,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      toolbarOverflow: toolbar.scrollWidth > toolbar.clientWidth + 1,
      innerWidth,
      tabsOverflow: tablist ? tablist.scrollWidth > tablist.clientWidth + 1 : false,
      searchWidth: search?.parentElement?.getBoundingClientRect().width ?? null,
      compactLabels: [...toolbar.querySelectorAll<HTMLElement>('button[title] > span')].map(
        (span) => ({
          name: span.textContent,
          hidden: getComputedStyle(span).position === 'absolute',
        }),
      ),
    };
  });
}

/** Clicks the end arrow until it goes, then checks the last tab lies inside the strip. */
async function checkTabsReachable(page: Page) {
  const strip = page.locator('main [data-page-toolbar] [role=tablist]');
  // The arrows are siblings after the strip; the end arrow is the last one while it shows.
  const arrows = strip.locator('xpath=following-sibling::button[@aria-hidden="true"]');
  await expect(arrows.last()).toBeVisible();
  for (let step = 0; step < 20; step += 1) {
    const left = await strip.evaluate(
      (list) => list.scrollWidth - list.clientWidth - list.scrollLeft,
    );
    if (left <= 1) break;
    await arrows.last().click();
    await page.waitForTimeout(400);
  }
  await expectLastTabInStrip(page);

  // Keyboard: End moves to the last tab; after a reload (deep link) it is still in view.
  await strip.evaluate((list) => (list.scrollLeft = 0));
  await strip.getByRole('tab', { selected: true }).focus();
  await page.keyboard.press('End');
  await expect(strip.getByRole('tab').last()).toBeFocused();
  await expectLastTabInStrip(page);
  await page.reload();
  await expect(strip.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true');
  await expectLastTabInStrip(page);
}

async function expectLastTabInStrip(page: Page) {
  // The tab change re-renders through the router first, then scrolls: poll briefly for it.
  await expect
    .poll(
      () =>
        page.locator('main [data-page-toolbar] [role=tablist]').evaluate((list) => {
          const last = list.querySelector('[role=tab]:last-child');
          if (!last) return false;
          const strip = list.getBoundingClientRect();
          const tab = last.getBoundingClientRect();
          return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
        }),
      { timeout: 3_000 },
    )
    .toBe(true);
}

async function expectPopoverInViewport(page: Page, name: string) {
  const button = page
    .locator('main [data-page-toolbar]')
    .getByRole('button', { name, exact: true });
  if ((await button.count()) === 0) return;
  await button.click();
  const box = await page.getByRole('dialog').last().boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  await page.keyboard.press('Escape');
}

for (const width of WINDOWS) {
  for (const zoom of ZOOMS) {
    test(`toolbars at ${width} px, ${Math.round(zoom * 100)} %`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Desktop project only');
      const page = await signedInPage(browser, baseURL, width, zoom);
      const results: Array<Measure & { page: string }> = [];
      for (const target of PAGES) {
        await page.goto(`/${ORG}/${target.path}`);
        // A cold dev server compiles each page on its first visit: allow for it.
        await expect(page.locator('main [data-page-toolbar]')).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');
        const result = await measure(page);
        results.push({ page: target.name, ...result });

        expect
          .soft(result.rows, `${target.name}: rows`)
          .toBeLessThanOrEqual(maxRows(width, zoom, target.name));
        expect.soft(result.pageOverflow, `${target.name}: page overflow`).toBe(false);
        expect.soft(result.toolbarOverflow, `${target.name}: toolbar overflow`).toBe(false);
        if (result.searchWidth !== null) {
          expect
            .soft(result.searchWidth, `${target.name}: search width`)
            .toBeGreaterThanOrEqual(159);
          expect.soft(result.searchWidth, `${target.name}: search width`).toBeLessThanOrEqual(242);
        }
        for (const label of result.compactLabels) {
          expect
            .soft(label.hidden, `${target.name}: "${label.name ?? ''}" icon-only`)
            .toBe(result.innerWidth < COMPACT_BELOW_PX);
        }
        if (result.tabsOverflow) await checkTabsReachable(page);
        if (width === 1280 && zoom === 1) {
          await expectPopoverInViewport(page, 'Filter');
          await expectPopoverInViewport(page, 'Show/Hide Columns');
        }
        if (zoom === 1 && ['Invoices', 'Jobs', 'My Expenses'].includes(target.name)) {
          await page.screenshot({
            path: testInfo.outputPath(`${target.name.replace(' ', '-')}-${width}.png`),
          });
        }
      }
      await testInfo.attach('measurements', {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });
      await page.context().close();
    });
  }
}

for (const width of [1440, 1280]) {
  test(`Invoices with two rows selected at ${width} px`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop project only');
    const page = await signedInPage(browser, baseURL, width, 1);
    await page.goto(`/${ORG}/billing/invoices`);
    const boxes = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    await expect(boxes.first()).toBeVisible({ timeout: 30_000 });
    await boxes.nth(0).check();
    if ((await boxes.count()) > 1) await boxes.nth(1).check();

    const group = page.getByRole('group', { name: 'Selected invoices' });
    await expect(group).toBeVisible();
    const toolbar = await page.locator('main [data-page-toolbar]').boundingBox();
    const bar = await group.boundingBox();
    expect(toolbar && bar && bar.y >= toolbar.y + toolbar.height - 1).toBe(true);
    const result = await measure(page);
    expect.soft(result.rows).toBe(1);
    expect.soft(result.pageOverflow).toBe(false);
    expect.soft(result.toolbarOverflow).toBe(false);
    await page.context().close();
  });
}

for (const width of [1024, 1280]) {
  test(`sidebar collapsed at ${width} px`, async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop project only');
    const page = await signedInPage(browser, baseURL, width, 1, true);
    const results: Array<Measure & { page: string }> = [];
    for (const target of PAGES) {
      await page.goto(`/${ORG}/${target.path}`);
      await expect(page.locator('main [data-page-toolbar]')).toBeVisible({ timeout: 30_000 });
      const result = await measure(page);
      results.push({ page: target.name, ...result });
      expect
        .soft(result.rows, `${target.name}: rows`)
        .toBeLessThanOrEqual(1 + (EXTRA_ROWS[target.name] ?? 0));
      expect.soft(result.pageOverflow, `${target.name}: page overflow`).toBe(false);
    }
    await testInfo.attach('measurements', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    await page.context().close();
  });
}
