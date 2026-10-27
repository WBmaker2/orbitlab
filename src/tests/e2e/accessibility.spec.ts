import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootWithCleanState, chooseOption } from './helpers';

async function expectNoCriticalViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const failures = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(
    failures.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test.describe('accessibility', () => {
  test('explore screen has no serious or critical axe violations', async ({ page }) => {
    await bootWithCleanState(page);
    await expectNoCriticalViolations(page);
  });

  test('mission screen has no serious or critical axe violations', async ({ page }) => {
    await bootWithCleanState(page, 'missions');
    await expectNoCriticalViolations(page);

    await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
    await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
    await expectNoCriticalViolations(page);

    await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();
    await expectNoCriticalViolations(page);
  });

  test('observer screen has no serious or critical axe violations', async ({ page }) => {
    await bootWithCleanState(page);
    await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
    await expectNoCriticalViolations(page);
  });

  test('teacher screen has no serious or critical axe violations', async ({ page }) => {
    await bootWithCleanState(page, 'teacher');
    await expectNoCriticalViolations(page);
  });

  test('keyboard focus stays visible and escape closes dialogs', async ({ page }) => {
    await bootWithCleanState(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    await page.getByRole('button', { name: '도움말과 설정' }).click();
    await expect(page.locator('#help-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#help-dialog')).toBeHidden();
  });
});
