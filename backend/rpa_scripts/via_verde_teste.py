import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.viaverde.pt/empresas');
  await page.getByRole('button', { name: 'Accept All Cookies' }).click();
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('');
  await page.getByRole('textbox', { name: 'Email' }).press('Tab');
  await page.getByRole('textbox', { name: 'Palavra-passe' }).fill('');
  await page.locator('#btnLogin').click();
  await page.getByRole('link', { name: 'Extratos e Movimentos', exact: true }).click();
  await page.locator('a').filter({ hasText: 'Movimentos' }).first().click();
  await page.getByRole('button', { name: 'Filtrar por:' }).click();
  await page.getByRole('textbox', { name: 'De:' }).click();
  await page.getByRole('button').filter({ hasText: 'next' }).click();
  await page.locator('#datepicker-131-4417-7').getByRole('button', { name: '05' }).click();
  await page.getByRole('textbox', { name: 'Até:' }).click();
  await page.getByRole('button', { name: '11' }).click();
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Excel' }).click();
  const download = await downloadPromise;
});