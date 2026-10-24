import { expect, test } from '@playwright/test';
import { copyDemo, serveLocal, useChinese, type Served } from './helpers.ts';

let srv: Served;
test.beforeAll(async () => {
  srv = await serveLocal(copyDemo());
});
test.afterAll(() => srv.stop());

test('overview shows stages, task completion and open clarifications (US2)', async ({ page }) => {
  await useChinese(page);
  await page.goto(srv.url);
  const row = (id: string) => page.locator(`tr[data-feature="${id}"]`);
  await expect(row('001-team-calendar').getByTestId('current-stage')).toHaveText('规范');
  await expect(row('002-user-login').getByTestId('current-stage')).toHaveText('实现');
  await expect(row('002-user-login').getByTestId('task-progress')).toContainText('4/10（40%）');
  await expect(row('002-user-login').getByTestId('open-clarifications')).toContainText('待澄清 2 处');
  await expect(row('003-notification-center').getByTestId('current-stage')).toHaveText('方案');
});

test('feature page: groups, checklists, analyze stage and clarification jump', async ({ page }) => {
  await useChinese(page);
  await page.goto(`${srv.url}#/f/002-user-login`);
  const view = page.getByTestId('feature-view');
  await expect(view.locator('[data-stage=analyze]')).toHaveAttribute('data-state', 'optional_unknown');
  await expect(view.locator('[data-stage=analyze]')).toContainText('可选·无法自动判断');
  await expect(view.locator('[data-stage=clarify]')).toHaveAttribute('data-state', 'needs_attention');
  await expect(view.locator('[data-stage=clarify]')).toContainText('待澄清 2 处');
  await expect(view.locator('[data-checklist=requirements]')).toContainText('已全部通过');
  await view.getByText('按用户故事').click();
  await expect(view.getByTestId('feature-tasks')).toContainText('US1');
  const clarify = page.getByTestId('feature-clarifications');
  await expect(clarify).toContainText('待澄清 2 处');
  await clarify.locator('a').first().click();
  await expect(page).toHaveURL(/h=nc-1/);
  await expect(page.locator('#nc-1')).toBeInViewport();
});
