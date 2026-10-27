import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bootWithCleanState } from './helpers';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
] as const;

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const body = await page.screenshot();
  await testInfo.attach(name, { body, contentType: 'image/png' });
  const dir = join('test-results', 'screenshots');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function openObserver(page: Page): Promise<void> {
  const layersTab = page.getByRole('tab', { name: '레이어' });
  if (await layersTab.isVisible()) await layersTab.click();
  await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
  await expect(page.locator('#observer-view')).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`visual smoke at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await bootWithCleanState(page);
    await expect(page.locator('#scale-badge')).toBeVisible();
    await capture(page, testInfo, `${viewport.name}-explore-spring`);

    await page.getByRole('button', { name: '하지', exact: true }).click();
    await expect(page.locator('[data-ref="top-season"]')).toContainText('북 여름');
    await capture(page, testInfo, `${viewport.name}-explore-summer`);

    await openObserver(page);
    await capture(page, testInfo, `${viewport.name}-observer`);

    await page.goto('/#/missions');
    await expect(page.getByRole('heading', { name: '북반구의 여름은 왜 생길까?' })).toBeVisible();
    await capture(page, testInfo, `${viewport.name}-missions`);

    await page.goto('/#/teacher');
    await expect(page.getByRole('heading', { name: '교사 모드' })).toBeVisible();
    await capture(page, testInfo, `${viewport.name}-teacher`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
