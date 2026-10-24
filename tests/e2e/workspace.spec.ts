/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { copyDemo, serveLocal, useChinese, type Served } from './helpers.ts';
let srv: Served;
test.beforeAll(async () => {
  srv = process.env.SPECKIT_WORKSPACE_URL
    ? { url: process.env.SPECKIT_WORKSPACE_URL, stop() {} }
    : await serveLocal(copyDemo());
});
test.afterAll(() => srv.stop());

test('compact workspace exposes documents and keeps both copy actions working', async ({ page, context }) => {
  await useChinese(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(srv.url);
  await page.locator('tr[data-feature="002-user-login"] a').first().click();
  await expect(page.getByTestId('next-step')).toBeVisible();
  await expect(page.locator('.guide-destination')).toBeVisible();
  await expect(page.locator('[data-stage=clarify]')).toContainText('待澄清 2 处');
  await expect(page.locator('[data-stage=clarify]')).not.toContainText('已跳过');
  const docs = await page.locator('.documents-card').boundingBox();
  expect(docs!.y + docs!.height).toBeLessThan(900);
  await expect(page.locator('.guide-details')).not.toHaveAttribute('open');
  await page.locator('.guide-details summary').click();
  await expect(page.locator('.guide-context')).toBeVisible();
  await expect(page.locator('.guide-context')).toContainText('任何能访问本项目');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '复制命令', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/speckit-clarify');
  await page.getByRole('button', { name: '复制通用指令', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('002-user-login');
  await page.locator('.documents-card').getByRole('link', { name: '规范', exact: true }).click();
  await expect(page.getByTestId('doc-body')).toBeVisible();
});

test('mobile and enlarged reading retain navigation and command controls', async ({ page }) => {
  await useChinese(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${srv.url}#/f/002-user-login`);
  await expect(page.getByRole('button', { name: '复制命令', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('.nav-toggle').click();
  await expect(page.locator('nav.sidebar')).toBeVisible();
  await page.locator('nav.sidebar').getByRole('link', { name: '001 团队日历' }).click();
  await expect(page.getByTestId('next-step')).toContainText('/speckit-plan');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.body.style.zoom = '2';
  });
  await expect(page.getByRole('button', { name: '复制命令', exact: true })).toBeVisible();
  const button = await page.getByRole('button', { name: '复制命令', exact: true }).boundingBox();
  expect(button!.x + button!.width).toBeLessThanOrEqual(1440);
});
