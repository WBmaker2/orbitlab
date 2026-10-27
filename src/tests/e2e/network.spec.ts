import { expect, test } from '@playwright/test';
import { bootWithCleanState, chooseOption } from './helpers';

test('does not call external services or AI APIs', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.protocol.startsWith('http')) return;
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return;
    external.push(request.url());
  });

  await bootWithCleanState(page);
  await page.getByRole('button', { name: '하지', exact: true }).click();
  await page.getByRole('button', { name: '지구 관측자 뷰' }).click();
  await page.getByRole('button', { name: '우주 뷰로 돌아가기' }).click();
  await page.getByRole('link', { name: '미션', exact: true }).click();
  await chooseOption(page, '지구의 자전축이 태양 쪽으로 기울어져서');
  await page.getByRole('button', { name: '예측 제출하고 장면 보기' }).click();
  await page.getByRole('button', { name: '관찰했어요, 정답 보기' }).click();

  expect(external).toEqual([]);
});
