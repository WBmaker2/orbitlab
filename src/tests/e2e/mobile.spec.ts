import { expect, test } from '@playwright/test';
import { bootWithCleanState, missionScore } from './helpers';

test.describe('mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await bootWithCleanState(page);
  });

  test('uses the bottom-sheet tabs and keeps the scale warning visible', async ({ page }) => {
    await expect(page.locator('#hud-tabs')).toBeVisible();
    await expect(page.getByRole('tab', { name: '시간' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#scale-badge')).toContainText('실제 축척 아님');
    await expect(page.locator('#scale-badge')).toBeVisible();

    const layersTab = page.getByRole('tab', { name: '레이어' });
    await layersTab.click();
    await expect(layersTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#slot-layers')).toBeVisible();

    await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
    await expect(page.locator('#observer-view')).toBeVisible();
    await expect(page.locator('#sky-canvas')).toBeVisible();
    await page.getByRole('button', { name: '우주 뷰로 돌아가기' }).click();
    await expect(page.locator('#hud')).toBeVisible();
  });

  test('opens the mission tab on the missions route', async ({ page }) => {
    await page.getByRole('link', { name: '미션', exact: true }).click();
    await expect(page).toHaveURL(/#\/missions$/);
    const missionTab = page.getByRole('tab', { name: '미션' });
    await expect(missionTab).toBeVisible();
    await expect(missionTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#slot-mission')).toBeVisible();
    await expect(page.getByRole('heading', { name: '북반구의 여름은 왜 생길까?' })).toBeVisible();
    await expect(missionScore(page)).toHaveText('0');
  });

  test('does not overflow horizontally', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
