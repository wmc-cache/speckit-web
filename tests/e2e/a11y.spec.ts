import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { copyDemo, docId, serveLocal, type Served } from './helpers.ts';

let srv: Served;
test.beforeAll(async () => {
  srv = await serveLocal(copyDemo());
});
test.afterAll(() => srv.stop());

for (const [name, hash] of [
  ['overview', ''],
  ['feature', '#/f/002-user-login'],
  ['document', `#/d/${docId('specs/002-user-login/spec.md')}`],
  ['search', '#/search?q=%E7%99%BB%E5%BD%95'],
]) {
  test(`no serious accessibility violations: ${name}`, async ({ page }) => {
    await page.goto(srv.url + hash);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).exclude('pre.shiki').exclude('pre.mermaid').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}
