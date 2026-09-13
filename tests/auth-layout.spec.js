import { test, expect } from '@playwright/test';

async function expectFixedForm(page) {
  const problems = await page.evaluate(() => {
    const issues = [];
    for (const el of document.querySelectorAll('.login-panel a, .login-panel button, .login-panel input, .login-heading, .login-footer, .login-error, .verification-notice')) {
      if (!el.getClientRects().length) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < -1 || rect.bottom > innerHeight + 1 || rect.left < -1 || rect.right > innerWidth + 1) issues.push(el.textContent || el.name);
    }
    const content = document.querySelector('.login-content').getBoundingClientRect();
    const footer = document.querySelector('.login-footer').getBoundingClientRect();
    if (content.bottom > footer.top + 1) issues.push('Formulário sobrepõe o rodapé');
    return issues;
  });
  expect(problems, 'Campos, mensagens e ações devem caber sem cortes').toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'instant' }));
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
}

test('entrada e cadastro cabem sem rolagem em notebook, celular e paisagem', async ({ page }, testInfo) => {
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
