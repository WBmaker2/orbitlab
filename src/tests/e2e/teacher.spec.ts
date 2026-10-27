import { expect, test } from '@playwright/test';
import {
  bootWithCleanState,
  completeSeasonsMission,
  missionScore,
  reloadKeepingState,
  timelineDate,
} from './helpers';

test.describe('teacher', () => {
  test.beforeEach(async ({ page }) => {
    await bootWithCleanState(page, 'missions');
  });

  test('shows answers, resets progress, and keeps the reset after reload', async ({ page }) => {
    await completeSeasonsMission(page);
    await page.getByRole('link', { name: '교사', exact: true }).click();

    await expect(page.getByRole('heading', { name: '교사 모드' })).toBeVisible();
    await expect(page.locator('[data-ref="done"]')).toHaveText('1');
    await expect(page.locator('[data-ref="correct"]')).toHaveText('1');
    await expect(page.locator('.teacher-answer').first()).toContainText(
      '지구의 자전축이 태양 쪽으로 기울어져서',
    );
    await expect(page.locator('.teacher-student-answer').first()).toContainText(
      '지구의 자전축이 태양 쪽으로 기울어져서',
    );

    await page.locator('.teacher-head-actions [data-action="reset"]').click();
    const dialog = page.locator('.teacher-screen dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('button[value="reset"]').click();

    await expect(page.locator('#toast')).toContainText('진행 기록을 초기화했습니다');
    await expect(page.locator('[data-ref="done"]')).toHaveText('0');
    await expect(page.locator('[data-ref="attempted"]')).toHaveText('0');

    await reloadKeepingState(page);
    await expect(page.locator('[data-ref="done"]')).toHaveText('0');
    await expect(page.locator('[data-ref="attempted"]')).toHaveText('0');
    const stored = await page.evaluate(() => window.localStorage.getItem('orbitlab.progress.v1'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}').completed).toEqual([]);
    expect(JSON.parse(stored ?? '{}').answers).toEqual({});
  });

  test('builds the printable worksheet with an optional answer key', async ({ page }) => {
    await page.getByRole('link', { name: '교사', exact: true }).click();
    const worksheet = page.locator('#worksheet');
    expect(await worksheet.textContent()).toContain('계절·달의 위상·식 현상 탐구 워크시트');
    expect(await worksheet.textContent()).not.toContain('교사용 답안');

    await page.getByRole('checkbox', { name: '교사용 답안 포함' }).check();
    expect(await worksheet.textContent()).toContain('교사용 답안');
    expect(await worksheet.textContent()).toContain('지구의 자전축이 태양 쪽으로 기울어져서');
    expect(await worksheet.textContent()).toContain('실제 일식·월식 예보가 아닙니다');
  });

  test('previews a mission scene in the explore route', async ({ page }) => {
    await page.getByRole('link', { name: '교사', exact: true }).click();
    await page.locator('details.teacher-mission').first().locator('summary').click();
    await page.locator('[data-action="preview"]').first().click();

    await expect(page).toHaveURL(/#\/explore$/);
    await expect(timelineDate(page)).toHaveText('2026년 6월 21일');
    await expect(page.locator('#toast')).toContainText('미션 장면을 탐구 화면에 불러왔습니다');
    await expect(page.locator('#scale-badge')).toBeVisible();
  });

  test('toggles projection settings without touching student progress', async ({ page }) => {
    await page.getByRole('link', { name: '교사', exact: true }).click();
    const teacher = page.locator('.teacher-screen');
    const labels = teacher.getByRole('checkbox', { name: '3D 라벨 표시' });
    const tiltAxis = teacher.getByRole('checkbox', { name: '자전축 표시' });

    await expect(labels).toBeChecked();
    await labels.uncheck();
    await expect(page.locator('#sr-live')).toContainText('3D 라벨을 껐습니다');
    await tiltAxis.uncheck();
    await expect(page.locator('#sr-live')).toContainText('자전축을 껐습니다');

    await page.getByRole('link', { name: '탐구', exact: true }).click();
    await expect(page.locator('input[data-layer="labels"]')).not.toBeChecked();
    await expect(page.locator('input[data-layer="tiltAxis"]')).not.toBeChecked();
    await page.getByRole('link', { name: '미션', exact: true }).click();
    await expect(missionScore(page)).toHaveText('0');
  });
});
