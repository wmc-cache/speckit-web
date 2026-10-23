/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { copyDemo, serveLocal, serveStatic, useChinese, type Served } from './helpers.ts';
for (const mode of ['local', 'static'] as const) {
  test.describe(`next step ${mode}`, () => {
    let srv: Served;
    test.beforeAll(async () => {
      srv = mode === 'local' ? await serveLocal(copyDemo()) : await serveStatic(copyDemo());
    });
    test.afterAll(() => srv.stop());
    test('shows contextual commands and copies them without switching the active feature', async ({
      page,
      context,
    }) => {
      await useChinese(page);
      await page.goto(`${srv.url}#/f/001-team-calendar`);
      const guide = page.getByTestId('next-step');
      await expect(guide).toContainText('制定实施方案');
      await expect(guide.locator('.command-copy code')).toHaveText('/speckit-plan');
      await expect(guide).toContainText('002-user-login');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await guide.getByRole('button', { name: '复制命令', exact: true }).click();
      await expect(guide.getByRole('button', { name: '已复制', exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/speckit-plan');
      await page.goto(`${srv.url}#/f/002-user-login`);
      await expect(page.getByTestId('next-step').locator('.command-copy code')).toHaveText(
        '/speckit-clarify',
      );
      await page.goto(`${srv.url}#/f/003-notification-center`);
      await expect(page.getByTestId('next-step').locator('.command-copy code')).toHaveText('/speckit-tasks');
    });
    test('keeps roadmap and command visible on mobile', async ({ page }) => {
      await useChinese(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${srv.url}#/f/001-team-calendar`);
      await expect(page.getByTestId('next-step')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
}
