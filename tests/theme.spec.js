import { expect, test } from '@playwright/test';

test('alterna o tema, atualiza o navegador e preserva a escolha', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Ativar modo escuro' });
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b0b0c');
  await expect.poll(() => page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      background: styles.getPropertyValue('--color-background').trim(),
      secondary: styles.getPropertyValue('--color-background-secondary').trim(),
      deep: styles.getPropertyValue('--color-deep-surface').trim(),
    };
  })).toEqual({ background: '#0b0b0c', secondary: '#151516', deep: '#050506' });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('psicologa_tema'))).toBe('dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
});

test('atualiza a seção animada sem conservar a cor do tema anterior', async ({ page }) => {
  await page.goto('/');
  const reflection = page.locator('.reflection-section');
  await reflection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();

  await expect.poll(() => reflection.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 25, 28)');
  await expect(reflection).toHaveCSS('color', 'rgb(238, 234, 226)');
});

test('usa a preferência escura do sistema na primeira visita', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
});

test('mantém o controle disponível nas telas de acesso', async ({ page }) => {
  await page.goto('/login');

  const toggle = page.getByRole('button', { name: 'Ativar modo escuro' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/adm/login');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
});

test('mantém o controle disponível na agenda administrativa', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('psicologa_tema', 'dark');
    localStorage.setItem('psicologa_token', 'token-de-teste');
    localStorage.setItem('psicologa_usuario', JSON.stringify({
      id: 7,
      nome: 'Mauricéia Soares',
      email: 'psicologa@example.com',
      tipo: 'admin',
    }));
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/agenda'
      ? { recorrentes: [], extras: [], bloqueios: [], horarios: [], proximas_excecoes: [] }
      : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/adm/agenda');

  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const modality = page.locator('.modality-field select');
  await expect(modality).toBeVisible();
  await expect(modality).toHaveCSS('appearance', 'none');
  await expect(modality.locator('option').first()).toHaveCSS('background-color', 'rgb(21, 21, 22)');
  await expect(modality.locator('option').first()).toHaveCSS('color', 'rgb(242, 240, 234)');
  await expect(modality.locator('option').nth(1)).toHaveCSS('background-color', 'rgb(11, 11, 12)');
  await modality.selectOption('online');
  await expect(modality).toHaveValue('online');
});
