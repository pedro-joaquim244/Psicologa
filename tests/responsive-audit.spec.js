import { test, expect } from '@playwright/test';

const sizes = [[320,568], [360,800], [375,812], [390,844], [414,896], [430,932], [768,1024], [1024,768], [1366,768], [1920,1080]];
const patient = { id: 7, nome: 'Paciente de teste com nome completo extenso', email: 'paciente.com.email.longo@example.com', telefone: '11999999999', tipo: 'paciente', email_verificado: true };
const appointment = { id: 1, nome_cliente: 'NomeMuitoLongoSemEspacosParaVerificarAQuebraNaAgendaProfissional', email_cliente: patient.email, telefone_cliente: patient.telefone, inicio: '2030-09-18 09:00:00', fim: '2030-09-18 09:50:00', criado_em: '2030-09-10 12:00:00', status: 'agendado', modalidade: 'online' };

async function mockApi(page) {
  await page.clock.setFixedTime(new Date('2030-09-10T15:00:00Z'));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/horarios') return route.fulfill({ json: { horarios: [{ horario: '09:00', fim: '09:50' }] } });
    if (path.endsWith('/me')) return route.fulfill({ json: { usuario: patient } });
    if (path.endsWith('/login')) return route.fulfill({ json: { verificacaoPendente: true, desafio: 'a'.repeat(64), email: patient.email, expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 } });
    if (path.endsWith('/cancelar')) return route.fulfill({ status: 503, json: { erro: 'Não foi possível cancelar a consulta neste momento. Confira sua conexão e tente novamente. Seu agendamento permanece reservado até a confirmação do cancelamento.' } });
    return route.fulfill({ json: [appointment] });
  });
}
async function widthCheck(page) {
  const overflow = await page.evaluate(() => {
    const width = innerWidth;
    return [...document.querySelectorAll('main h1, main h2, main h3, main p, main button, main input, main select, main address, header nav, footer a, [role="alertdialog"]')]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > width + 1; })
      .map(el => `${el.tagName}.${el.className}: ${el.textContent.slice(0,70)}`);
  });
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function seed(page, kind) {
  await page.evaluate(({ kind, patient }) => {
    localStorage.clear();
    const professional = kind === 'profissional';
    localStorage.setItem(professional ? 'psicologa_token' : 'paciente_token', 'responsive-test-token');
    localStorage.setItem(professional ? 'psicologa_usuario' : 'paciente_usuario', JSON.stringify(professional ? { id: 1, nome: 'Dra. Helena', tipo: 'psicologa' } : patient));
  }, { kind, patient });
}
for (const [width, height] of sizes) {
  test(`auditoria ${width}x${height}: todas as rotas, formulários, agenda e modal`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Matriz explícita executada uma vez.');
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await page.evaluate(() => document.fonts.ready);
    for (const section of await page.locator('main section').all()) { await section.scrollIntoViewIfNeeded(); await widthCheck(page); }
    await page.locator('.audience-trigger').last().click(); await widthCheck(page);
    await page.locator('#faq-question-4').click(); await widthCheck(page);
    if (width < 1200) { await page.getByRole('button', { name: 'Abrir menu' }).click(); await widthCheck(page); await page.getByRole('button', { name: 'Fechar menu' }).click(); }
    for (const path of ['/login', '/cadastro', '/adm/login', '/adm']) {
      await page.goto(path); await page.reload(); await widthCheck(page);
      for (const input of await page.locator('input').all()) expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      await page.locator('.login-submit').scrollIntoViewIfNeeded(); await expect(page.locator('.login-submit')).toBeInViewport();
    }
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
    await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByLabel('Código de verificação')).toBeVisible(); await widthCheck(page);
    await seed(page, 'paciente');
    for (const path of ['/minhas-consultas', '/minha-conta']) { await page.goto(path); await page.reload(); await expect(page.locator('.patient-page')).toBeVisible(); await widthCheck(page); }
    await page.goto('/#agendamento');
    await page.locator('[data-date="2030-09-18"]').click();
    await page.getByRole('button', { name: '09:00 até 09:50' }).click();
    await page.locator('.booking-submit').scrollIntoViewIfNeeded(); await widthCheck(page);
    await seed(page, 'profissional'); await page.goto('/adm/agenda'); await page.reload();
    await expect(page.locator('.appointment-item')).toBeVisible(); await widthCheck(page);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const modal = page.getByRole('alertdialog'); await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancelar agendamento' }).click(); await expect(modal.getByRole('alert')).toBeVisible();
    const box = await modal.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    await modal.getByRole('button', { name: 'Voltar' }).scrollIntoViewIfNeeded(); await expect(modal.getByRole('button', { name: 'Voltar' })).toBeInViewport(); await widthCheck(page);
    await modal.getByRole('button', { name: 'Voltar' }).click({ trial: true });
    await page.screenshot({ path: info.outputPath(`modal-${width}.png`) });
    await page.keyboard.press('Escape'); await page.goto('/'); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`landing-${width}.png`) });
    expect(errors).toEqual([]);
  });
}

test('agendamento usa Brasília mesmo em navegador de outro fuso', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'Fuso testado uma vez.');
  const context = await browser.newContext({ timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce', baseURL: 'http://127.0.0.1:4173' });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2030-09-10T02:00:00Z'));
    await page.route('**/api/horarios?*', route => route.fulfill({ json: { horarios: [{ horario: '23:30', fim: '23:59' }] } }));
    await page.goto('/#agendamento');
    await expect(page.locator('[data-date="2030-09-09"]')).toBeEnabled();
    await page.locator('[data-date="2030-09-09"]').click();
    await expect(page.getByRole('button', { name: '23:30 até 23:59' })).toBeVisible();
  } finally { await context.close(); }
});
