import { expect, test } from '@playwright/test';
import { bootWithCleanState, waitForApp } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('performance budget', () => {
  test.use({ serviceWorkers: 'block' });

  test('loads within 2.5 seconds on a simulated slow 4G connection', async ({ page, context }) => {
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    await page.goto('/#/explore', { waitUntil: 'load' });
    await waitForApp(page);

    const loadMs = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;
      return navigation ? navigation.loadEventEnd - navigation.startTime : Infinity;
    });
    expect(loadMs).toBeLessThan(2500);
  });

  test('keeps the render loop running while the simulation plays', async ({ page }) => {
    await bootWithCleanState(page);
    await page.locator('#slot-time [data-ref="play"]').click();

    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          let started = 0;
          const tick = (time: number) => {
            if (started === 0) started = time;
            frames += 1;
            if (time - started >= 1200) {
              resolve((frames * 1000) / (time - started));
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );

    expect(fps).toBeGreaterThan(24);
  });
});
