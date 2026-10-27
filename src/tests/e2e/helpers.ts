import { expect, type Page } from '@playwright/test';

export async function waitForApp(page: Page): Promise<void> {
  await expect(page.locator('#topbar')).toBeVisible();
  await page.locator('#boot').waitFor({ state: 'detached' });
  await expect(page.locator('.scene-canvas')).toBeAttached();
}

export async function bootWithCleanState(page: Page, route = 'explore'): Promise<void> {
  await page.goto(`/#/${route}`);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await waitForApp(page);
}

export async function reloadKeepingState(page: Page): Promise<void> {
  await page.waitForTimeout(750);
  await page.reload();
  await waitForApp(page);
}

export function currentKoreaDateText(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

export function currentKoreaTimeText(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function topDate(page: Page) {
  return page.locator('[data-ref="top-date"]');
}

export function timelineDate(page: Page) {
  return page.locator('#slot-time [data-ref="date-main"]');
}

export function missionScore(page: Page) {
  return page.locator('.mission-score strong');
}

export async function chooseOption(page: Page, text: string): Promise<void> {
  await page.locator('.option').filter({ hasText: text }).click();
}

export async function completeSeasonsMission(page: Page): Promise<void> {
  await page.goto('/#/missions');
  await waitForApp(page);
  await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
  await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
  await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();
  await expect(page.getByRole('heading', { name: '정답입니다!' })).toBeVisible();
}
