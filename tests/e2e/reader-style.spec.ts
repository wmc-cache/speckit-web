/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { copyDemo, docId, serveLocal, serveStatic, useChinese, type Served } from './helpers.ts';
for (const mode of ['local', 'static'] as const) {
  test.describe(`A overview and reader ${mode}`, () => {
    let srv: Served;
    test.beforeAll(async () => {
      srv = mode === 'local' ? await serveLocal(copyDemo()) : await serveStatic(copyDemo());
    });
    test.afterAll(() => srv.stop());
    test('overview reaches the reader and desktop outline keeps chapter links', async ({ page }) => {
      await useChinese(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(srv.url);
      await expect(page.locator('.overview-heading .feature-metrics')).toContainText('特性总数');
      await page.locator('tr[data-feature="002-user-login"] a').first().click();
      await page.locator('.documents-card').getByRole('link', { name: '规范', exact: true }).click();
      await expect(page.locator('.reading-toolbar')).toContainText('specs/002-user-login/spec.md');
      await expect(page.locator('aside.outline details')).toHaveAttribute('open');
      await page.locator('aside.outline a').filter({ hasText: 'Requirements' }).first().click();
      await expect(page.locator('[id="requirements-mandatory"]')).toBeInViewport();
      await expect(page).toHaveURL(/h=requirements-mandatory/);
    });
    test('mobile overview and reader stay within viewport with usable outline', async ({ page }) => {
      await useChinese(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(srv.url);
      await expect(page.getByRole('region', { name: '特性进展' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const next = page.locator('tr[data-feature="001-team-calendar"] .overview-next');
      await expect(next).toBeVisible();
      const bounds = await next.boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/spec.md')}`);
      await expect(page.getByTestId('doc-body')).toBeVisible();
      await expect(page.locator('aside.outline details')).not.toHaveAttribute('open');
      await page.locator('aside.outline summary').click();
      await page.locator('aside.outline a').filter({ hasText: 'Requirements' }).first().click();
      await expect(page.locator('[id="requirements-mandatory"]')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
}
