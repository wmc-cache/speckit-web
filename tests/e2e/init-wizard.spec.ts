import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO, serveLocal, useChinese, type Served } from './helpers.ts';

let srv: Served;
let dir: string;
test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-wizard-'));
  const env = {
    ...process.env,
    PATH: `${path.join(REPO, 'tests/fixtures/bin')}${path.delimiter}${process.env.PATH}`,
  };
  srv = await serveLocal(dir, env);
});
test.afterAll(() => srv.stop());

test('initializes an empty directory from the browser (US3)', async ({ page }) => {
  await useChinese(page);
  await page.goto(srv.url);
  await expect(page.getByTestId('not-speckit')).toContainText('未检测到 Spec Kit 项目');
  await page.getByRole('link', { name: '打开初始化向导' }).click();
  const wizard = page.getByTestId('init-wizard');
  await expect(wizard).toContainText('0.16.4-fake');

  // Custom dropdown: keyboard open, filter, arrows, Esc closes.
  const dd = page.getByTestId('integration-dropdown');
  const button = dd.getByRole('button');
  await button.focus();
  await page.keyboard.press('ArrowDown');
  await expect(dd.getByRole('listbox')).toBeVisible();
  await expect(dd.locator('[aria-selected=true]')).toContainText('✓');
  await page.keyboard.press('Escape');
  await expect(dd.getByRole('listbox')).toHaveCount(0);
  await button.click();
  await dd.getByRole('textbox').fill('fake');
  await page.keyboard.press('Enter');
  await expect(button).toContainText('Fake Agent');
  await button.click();
  await dd.getByRole('textbox').fill('claude');
  await page.keyboard.press('Enter');
  await expect(button).toContainText('Claude Code');

  await wizard.getByRole('button', { name: '新建子目录' }).click();
  await page.locator('#init-name').fill(' .. ');
  await wizard.getByRole('button', { name: '生成预览' }).click();
  await expect(wizard).toContainText('目录名称不能为 . 或 ..。');
  await wizard.getByRole('button', { name: '当前目录' }).click();
  await wizard.getByRole('button', { name: '生成预览' }).click();
  await expect(page.getByTestId('init-files')).toContainText('.specify/init-options.json');
  await wizard.getByRole('button', { name: '开始初始化' }).click();
  await expect(page.getByTestId('init-done')).toBeVisible();
  await page.getByRole('button', { name: '打开查看器' }).click();
  await expect(page.locator('nav.sidebar')).toContainText('未填写');
  await expect(page.getByTestId('overview')).toContainText('还没有特性');
  expect(fs.existsSync(path.join(dir, '.specify/init-options.json'))).toBe(true);
});
