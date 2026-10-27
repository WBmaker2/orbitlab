import { expect, test } from '@playwright/test';
import {
  bootWithCleanState,
  reloadKeepingState,
  timelineDate,
  topDate,
  waitForApp,
} from './helpers';

test.describe('explore', () => {
  test.beforeEach(async ({ page }) => {
    await bootWithCleanState(page);
  });

  test('shows the epoch scene, season, phase and scale warning', async ({ page }) => {
    await expect(topDate(page)).toHaveText('2026년 3월 20일');
    await expect(page.locator('[data-ref="top-season"]')).toContainText('북 봄');
    await expect(page.locator('[data-ref="top-season"]')).toContainText('남 가을');
    await expect(page.locator('[data-ref="status-phase"]')).toBeVisible();
    await expect(page.locator('#scale-badge')).toContainText('실제 축척 아님');
    await expect(page.locator('#scale-badge')).toBeVisible();
    await expect(page.locator('[data-ref="diagram-text"]')).toContainText('북반구는 봄');
    await expect(page.locator('body')).toContainText('실제 일식·월식 예보가 아닙니다');
  });

  test('scrubs the timeline and jumps to season boundaries', async ({ page }) => {
    await page.getByRole('button', { name: '하지', exact: true }).click();
    await expect(timelineDate(page)).toHaveText('2026년 6월 21일');
    await expect(page.locator('[data-ref="top-season"]')).toContainText('북 여름');

    await page.getByRole('button', { name: '동지', exact: true }).click();
    await expect(timelineDate(page)).toHaveText('2026년 12월 21일');
    await expect(page.locator('[data-ref="top-season"]')).toContainText('북 겨울');

    const range = page.locator('#slot-time input[type="range"]');
    await range.fill('0');
    await expect(timelineDate(page)).toHaveText('2026년 3월 20일');

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await expect(timelineDate(page)).toHaveText('2026년 3월 21일');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(timelineDate(page)).toHaveText('2026년 3월 28일');
  });

  test('toggles playback and respects the current speed preset', async ({ page }) => {
    const play = page.locator('#slot-time [data-ref="play"]');
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect(play).toContainText('일시정지');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#slot-time select[data-ref="speed"]').selectOption('month');
    await expect(page.locator('#sr-live')).toContainText('시간 속도를 1개월 / 초로 바꿨습니다');
  });

  test('switches to the Earth observer view and back', async ({ page }) => {
    await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
    await expect(page.locator('#observer-view')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();
    await expect(page.locator('#scene-status')).toBeHidden();
    await expect(page.locator('#sky-canvas')).toBeVisible();
    await expect(page.locator('.observer-place')).toContainText('서울');
    await expect(page.locator('.model-badge')).toHaveText('개념 모형');

    await page.getByRole('button', { name: '우주 뷰로 돌아가기' }).click();
    await expect(page.locator('#observer-view')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#scale-badge')).toBeVisible();
  });

  test('reports day and night in the observer view', async ({ page }) => {
    await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
    const observerRange = page.locator('[data-ref="observer-timeline"] input[type="range"]');

    await observerRange.fill('0.15');
    await expect(page.locator('[data-ref="observer-sun"]')).toContainText('지평선 위');
    await expect(page.locator('[data-ref="observer-text"]')).toContainText('지금은 낮');

    await observerRange.fill('0.65');
    await expect(page.locator('[data-ref="observer-sun"]')).toContainText('지평선 아래');
    await expect(page.locator('[data-ref="observer-text"]')).toContainText(/지금은 (밤|박명)/);
  });

  test('persists layer settings across reloads', async ({ page }) => {
    const orbits = page.locator('input[data-layer="orbits"]');
    await expect(orbits).toBeChecked();
    await orbits.uncheck();
    await expect(page.locator('#sr-live')).toContainText('공전 궤도를 껐습니다.');
    await reloadKeepingState(page);
    await expect(page.locator('input[data-layer="orbits"]')).not.toBeChecked();
  });

  test('honors reduced motion and the help dialog', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => window.localStorage.clear());
    await page.reload();
    await waitForApp(page);
    await expect(page.locator('body')).toHaveClass(/reduce-motion/);

    await page.getByRole('button', { name: '도움말과 설정' }).click();
    const dialog = page.locator('#help-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('실제 일식·월식 예보가 아닙니다');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
