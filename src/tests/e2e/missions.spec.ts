import { expect, test, type Page } from '@playwright/test';
import {
  bootWithCleanState,
  chooseOption,
  completeSeasonsMission,
  missionScore,
  reloadKeepingState,
  timelineDate,
} from './helpers';

async function tabUntil(page: Page, selector: string, maxTabs = 120): Promise<void> {
  for (let index = 0; index < maxTabs; index += 1) {
    const focused = await page.evaluate(
      (target) => document.activeElement?.matches(target) ?? false,
      selector,
    );
    if (focused) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard focus never reached ${selector}`);
}

test.describe('missions', () => {
  test.beforeEach(async ({ page }) => {
    await bootWithCleanState(page, 'missions');
  });

  test('locks time until the prediction is submitted', async ({ page }) => {
    const play = page.locator('#slot-time [data-ref="play"]');
    const range = page.locator('#slot-time input[type="range"]');
    await expect(play).toBeDisabled();
    await expect(range).toBeDisabled();
    await expect(page.locator('#slot-time [data-ref="hint"]')).toContainText(
      '먼저 예측을 제출하면 시간을 움직일 수 있습니다',
    );
    await expect(page.getByRole('heading', { name: '북반구의 여름은 왜 생길까?' })).toBeVisible();

    await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
    await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
    await expect(play).toBeEnabled();
    await expect(range).toBeEnabled();
    await expect(timelineDate(page)).toHaveText('2026년 6월 21일');
  });

  test('completes a mission correctly and saves progress', async ({ page }) => {
    await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
    await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
    await expect(page.locator('.mission-submitted')).toContainText(
      '지구의 자전축이 태양 쪽으로 기울어져서',
    );
    await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();

    await expect(page.getByRole('heading', { name: '정답입니다!' })).toBeVisible();
    await expect(page.locator('.takeaway')).toContainText('계절은 거리가 아니라');
    await expect(missionScore(page)).toHaveText('1');

    await reloadKeepingState(page);
    await expect(missionScore(page)).toHaveText('1');
    await expect(
      page.locator('button[data-mission-id="seasons-tilt"] .mission-pick-check'),
    ).toBeVisible();
  });

  test('handles an incorrect answer, retry, and moving to the next mission', async ({ page }) => {
    await chooseOption(page, '지구가 태양에 가장 가까워져서');
    await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
    await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();

    await expect(page.getByRole('heading', { name: '정답을 함께 확인해요' })).toBeVisible();
    await expect(page.locator('.answer-compare')).toContainText(
      '지구의 자전축이 태양 쪽으로 기울어져서',
    );
    await expect(missionScore(page)).toHaveText('0');

    await page.getByRole('button', { name: '다시 도전' }).click();
    await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
    await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
    await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();
    await expect(page.getByRole('heading', { name: '정답입니다!' })).toBeVisible();

    await page.getByRole('button', { name: '다음 미션' }).click();
    await expect(
      page.getByRole('heading', { name: '남반구의 크리스마스는 왜 여름일까?' }),
    ).toBeVisible();
    await expect(page.locator('#slot-time [data-ref="play"]')).toBeDisabled();
  });

  test('can complete the first mission using only the keyboard', async ({ page }) => {
    await page.keyboard.press('Tab');
    await tabUntil(page, 'input[name="mission-option"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await tabUntil(page, '[data-action="submit"]');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('button', { name: '관찰했어요, 정답 보기' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: '정답입니다!' })).toBeVisible();
    await expect(missionScore(page)).toHaveText('1');
  });

  test('offers an explore route back without losing completion', async ({ page }) => {
    await completeSeasonsMission(page);
    await page.getByRole('button', { name: '탐구 화면으로' }).click();
    await expect(page).toHaveURL(/#\/explore$/);
    await expect(page.locator('#hud')).toBeVisible();
    await page.getByRole('link', { name: '미션', exact: true }).click();
    await expect(missionScore(page)).toHaveText('1');
  });
});
