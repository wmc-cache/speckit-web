import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { copyDemo, docId, serveLocal, serveStatic, useChinese, type Served } from './helpers.ts';

test.describe('local mode', () => {
  let root: string;
  let srv: Served;
  test.beforeAll(async () => {
    root = copyDemo();
    srv = await serveLocal(root);
  });
  test.afterAll(() => srv.stop());

  test('lists features in order, renders documents, outline and links (US1)', async ({ page }) => {
    await useChinese(page);
    await page.goto(srv.url);
    const nav = page.locator('nav.sidebar');
    await expect(nav.locator('.nav-feature')).toHaveCount(3);
    await expect(nav.locator('.nav-feature').nth(0)).toContainText('团队日历');
    await expect(nav.locator('.nav-feature').nth(1)).toContainText('当前');
    await expect(nav.getByText('项目准则')).toBeVisible();

    await nav.locator('.nav-feature').nth(1).locator('a').first().click();
    await expect(page.getByTestId('feature-view')).toBeVisible();
    await expect(nav.getByText('研究')).toBeVisible();
    await expect(nav.locator('.nav-missing').filter({ hasText: '研究' })).toContainText('未生成');

    await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/plan.md')}`);
    const body = page.getByTestId('doc-body');
    await expect(body.locator('table').first()).toBeVisible();
    await expect(body.locator('pre.shiki')).toBeVisible();
    await expect(body.locator('pre.mermaid svg')).toBeVisible({ timeout: 15000 });

    await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/tasks.md')}`);
    await expect(body.locator('input[type=checkbox][checked]')).toHaveCount(4);

    await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/spec.md')}`);
    const outlineLink = page.locator('aside.outline a').filter({ hasText: 'Requirements' }).first();
    await outlineLink.click();
    await expect(page).toHaveURL(/h=requirements-mandatory/);
    const shared = page.url();
    const other = await page.context().newPage();
    await other.goto(shared);
    await expect(other.locator('[id="requirements-mandatory"]')).toBeInViewport();
    await other.close();

    await body.getByRole('link', { name: '实施方案' }).click();
    await expect(page).toHaveURL(new RegExp(docId('specs/002-user-login/plan.md')));
  });

  test('constitution shows its version and dates', async ({ page }) => {
    await useChinese(page);
    await page.goto(`${srv.url}#/constitution`);
    await expect(page.getByTestId('constitution-meta')).toContainText('1.1.0');
    await expect(page.getByTestId('constitution-meta')).toContainText('2026-10-15');
  });

  test('live reload: page updates within 2 s and warns about deleted docs (SC-004)', async ({ page }) => {
    await useChinese(page);
    await page.goto(srv.url);
    const row = page.locator('tr[data-feature="002-user-login"] [data-testid=task-progress]');
    await expect(row).toContainText('4/10');
    const tasks = path.join(root, 'specs/002-user-login/tasks.md');
    fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace('- [ ] T006', '- [x] T006'));
    await expect(row).toContainText('5/10', { timeout: 2000 });

    const quick = path.join(root, 'specs/002-user-login/quickstart.md');
    await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/quickstart.md')}`);
    await expect(page.getByTestId('doc-body')).toBeVisible();
    fs.rmSync(quick);
    await expect(page.getByRole('alert')).toContainText('该文档已被删除', { timeout: 3000 });
  });
});

test.describe('static mode under a sub-path', () => {
  let srv: Served;
  test.beforeAll(async () => {
    srv = await serveStatic(copyDemo());
  });
  test.afterAll(() => srv.stop());

  test('browses the same content without any /api/ request', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', (r) => r.url().includes('/api/') && apiCalls.push(r.url()));
    await useChinese(page);
    await page.goto(srv.url);
    await expect(page.locator('nav.sidebar .nav-feature')).toHaveCount(3);
    await expect(page.locator('.live-indicator')).toHaveCount(0);
    await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/spec.md')}`);
    await expect(page.getByTestId('doc-body').locator('h1')).toContainText('用户登录');
    await page.getByTestId('doc-body').getByRole('link', { name: '任务清单' }).click();
    await expect(page.getByTestId('doc-body').locator('h1')).toContainText('Tasks');
    await page.goto(`${srv.url}#/init`);
    await expect(page.getByText('静态站点不提供初始化功能')).toBeVisible();
    expect(apiCalls).toEqual([]);
  });
});
