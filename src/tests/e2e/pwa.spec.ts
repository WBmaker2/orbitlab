import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { bootWithCleanState, currentKoreaDateText, waitForApp } from './helpers';

const DIST = join(process.cwd(), 'dist');

test.describe('production build and PWA', () => {
  test('ships the expected static assets within the bundle budget', async () => {
    expect(existsSync(join(DIST, 'index.html'))).toBe(true);
    expect(existsSync(join(DIST, 'sw.js'))).toBe(true);
    expect(existsSync(join(DIST, 'manifest.webmanifest'))).toBe(true);
    expect(existsSync(join(DIST, 'icons/icon-192.png'))).toBe(true);
    expect(existsSync(join(DIST, 'icons/icon-512.png'))).toBe(true);

    const assets = ['index.html', 'sw.js', 'manifest.webmanifest'];
    const assetDirs = ['assets'];
    for (const dir of assetDirs) {
      if (!existsSync(join(DIST, dir))) continue;
      for (const entry of readDirRecursive(join(DIST, dir))) {
        if (/\.(js|css)$/.test(entry)) assets.push(entry.replace(`${DIST}/`, ''));
      }
    }

    let gzippedBytes = 0;
    for (const asset of assets) {
      const file = join(DIST, asset);
      if (!existsSync(file)) continue;
      gzippedBytes += gzipSync(readFileSync(file)).byteLength;
    }

    expect(gzippedBytes).toBeLessThan(800 * 1024);
    expect(statSync(join(DIST, 'index.html')).size).toBeGreaterThan(0);
  });

  test('works offline after the first load', async ({ page, context }) => {
    test.slow();
    await bootWithCleanState(page);

    await page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false;
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration.active);
      },
      undefined,
      { timeout: 20_000 },
    );

    await page.reload();
    await waitForApp(page);
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 15_000,
      })
      .toBe(true);

    await context.setOffline(true);
    await page.reload();
    await waitForApp(page);
    await expect(page.locator('#topbar')).toContainText('OrbitLab');
    await expect(page.locator('[data-ref="top-date"]')).toHaveText(currentKoreaDateText());
    await context.setOffline(false);
  });
});

function readDirRecursive(dir: string): string[] {
  const entries = readdirSyncSafe(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...readDirRecursive(path));
    else files.push(path);
  }
  return files;
}

function readdirSyncSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
