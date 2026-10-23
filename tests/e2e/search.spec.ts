import { expect, test, type Page } from '@playwright/test';
import { copyDemo, docId, serveLocal, serveStatic, useChinese, type Served } from './helpers.ts';

async function searchAndCrossRef(page: Page, url: string) {
  await useChinese(page);
  await page.goto(url);
  await page.getByTestId('search-input').fill('登录');
  await expect(page.getByTestId('search-hit')).toHaveCount(2);
  await expect(page.getByTestId('search-hit').first().locator('mark')).toHaveText('登录');
  await page.getByTestId('search-hit').first().click();
  await expect(page.locator('mark.search-highlight').first()).toBeVisible();

  await page.goto(`${url}#/d/${docId('specs/002-user-login/tasks.md')}`);
  await page.getByTestId('doc-body').locator('a.xref', { hasText: 'FR-003' }).click();
  await expect(page).toHaveURL(new RegExp(`${docId('specs/002-user-login/spec.md')}\\?h=fr-003`));
  await expect(page.locator('#fr-003')).toBeInViewport();
}

test.describe('search & cross references (US4)', () => {
  let local: Served;
  let stat: Served;
  test.beforeAll(async () => {
    local = await serveLocal(copyDemo());
    stat = await serveStatic(copyDemo());
  });
  test.afterAll(() => {
    local.stop();
    stat.stop();
  });

  test('local mode', async ({ page }) => searchAndCrossRef(page, local.url));
  test('static mode', async ({ page }) => searchAndCrossRef(page, stat.url));
});
