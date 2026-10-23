import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { copyDemo, docId, serveLocal, serveStatic, useChinese, type Served } from './helpers.ts';

for (const mode of ['local', 'static'] as const) {
  test.describe(`convergence ${mode}`, () => {
    let srv: Served;
    let root: string;
    const rel = 'specs/002-user-login/large.md';
    test.beforeAll(async () => {
      root = copyDemo();
      fs.writeFileSync(
        path.join(root, rel),
        '# Large\n\n## Repeat\n\n' +
          ('filler '.repeat(100) + '\n\n').repeat(1600) +
          '## Repeat\n\nＡＢＣ secondkeyword\n\n[NEEDS CLARIFICATION: later]\n',
      );
      fs.writeFileSync(path.join(root, 'specs/002-user-login/live.md'), '# Live\n\n[New](./new.md)\n');
      srv = mode === 'local' ? await serveLocal(root) : await serveStatic(root);
    });
    test.afterAll(() => srv.stop());
    test('artifact routes and missing artifacts work', async ({ page }) => {
      await useChinese(page);
      await page.goto(`${srv.url}#/f/002-user-login/spec`);
      await expect(page.getByTestId('doc-body').locator('h1')).toContainText('用户登录');
      await page.goto(`${srv.url}#/f/002-user-login/contracts`);
      await expect(page.locator('main').getByRole('link')).not.toHaveCount(0);
      await page.goto(`${srv.url}#/f/002-user-login/research`);
      await expect(page.locator('main')).toContainText('未生成');
    });
    test('loads a later section from its deep link and updates normalized highlights', async ({ page }) => {
      await page.goto(`${srv.url}#/d/${docId(rel)}?q=abc`);
      await expect(page.locator('#repeat-1')).toBeInViewport();
      await expect(page.locator('mark.search-highlight')).toHaveText('ＡＢＣ');
      await expect(page.locator('aside.outline a').filter({ hasText: 'Repeat' })).toHaveCount(2);
      await page.goto(`${srv.url}#/d/${docId(rel)}?h=repeat-1&q=secondkeyword`);
      await expect(page.locator('mark.search-highlight')).toHaveText('secondkeyword');
      await page.goto(`${srv.url}#/d/${docId(rel)}?h=repeat-1`);
      await expect(page.locator('mark.search-highlight')).toHaveCount(0);
    });
    if (mode === 'local')
      test('refreshes dependent links and recovers missed changes after reconnect', async ({
        page,
        context,
      }) => {
        await page.goto(`${srv.url}#/d/${docId('specs/002-user-login/live.md')}`);
        await expect(page.locator('[data-unpublished]')).toBeVisible();
        fs.writeFileSync(path.join(root, 'specs/002-user-login/new.md'), '# New');
        await expect(page.getByTestId('doc-body').getByRole('link', { name: 'New' })).toBeVisible({
          timeout: 2000,
        });
        await context.setOffline(true);
        fs.writeFileSync(path.join(root, 'specs/002-user-login/live.md'), '# Reconnected content');
        await context.setOffline(false);
        await expect(page.getByTestId('doc-body')).toContainText('Reconnected content', { timeout: 10000 });
        fs.rmSync(path.join(root, 'specs/002-user-login/live.md'));
        await expect(page.getByRole('alert')).toBeVisible();
        fs.writeFileSync(path.join(root, 'specs/002-user-login/live.md'), '# Restored');
        await expect(page.getByTestId('doc-body')).toContainText('Restored', { timeout: 2000 });
      });
  });
}
