import { test, expect } from '@playwright/test';

async function expectFixedForm(page) {
  // Rolagem vertical é necessária com teclado, zoom ou conteúdo extenso.
  // Cada controle deve ser alcançável, sem sobrepor conteúdo ou sair da largura.
  for (const control of await page.locator('.login-panel input, .login-panel button, .login-panel a').all()) {
    if (!await control.isVisible()) continue;
    await control.scrollIntoViewIfNeeded();
    const rect = await control.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(-1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(rect.y).toBeGreaterThanOrEqual(-1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  }
  const overlap = await page.evaluate(() => document.querySelector('.login-content').getBoundingClientRect().bottom > document.querySelector('.login-footer').getBoundingClientRect().top + 1);
  expect(overlap).toBe(false);
}

test('entrada e cadastro ficam acessíveis em notebook, celular e paisagem', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz de tamanhos executada uma vez.');
  for (const [width, height] of [[1440,900], [1366,768], [1024,650], [768,1024], [390,844], [375,667], [320,568], [844,390], [667,375], [390,420], [375,367]]) {
    await page.setViewportSize({ width, height });
    for (const route of ['/login', '/cadastro', '/adm/login']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFixedForm(page);
    }
  }
});

test('erros e confirmação de e-mail permanecem acessíveis em uma tela baixa', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Estados compactos executados uma vez.');
  await page.route('**/api/pacientes/cadastro', route => route.fulfill({ status: 409, json: { erro: 'Já existe uma conta com esse e-mail.' } }));
  await page.route('**/api/pacientes/login', route => route.fulfill({ json: { verificacaoPendente: true, desafio: 'a'.repeat(64), email: 'paciente@example.com', expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 } }));
  for (const [width, height] of [[320,568], [375,367], [667,375]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/cadastro');
    await page.getByLabel('Nome completo').fill('Paciente Teste');
    await page.getByLabel('WhatsApp com DDD').fill('16999998888');
    await page.getByLabel('E-mail', { exact: true }).fill('paciente@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectFixedForm(page);
    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await page.getByLabel('E-mail', { exact: true }).fill('paciente@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByLabel('Código de verificação')).toBeFocused();
    await expectFixedForm(page);
  }
  await page.getByRole('link', { name: /Voltar ao site/, exact: false }).last().click();
  await expect(page.locator('html')).not.toHaveClass(/auth-screen/);
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
