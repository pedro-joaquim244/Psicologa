import { test, expect } from '@playwright/test';

const patient = { id: 7, nome: 'Joaquim Sousa', email: 'joaquim@example.com', telefone: '16999998888', tipo: 'paciente', email_verificado: true };
const professional = { id: 1, nome: 'Dra. Helena Martins', tipo: 'psicologa', email_verificado: true };
const appointment = (id, inicio, status, modalidade = 'online') => ({ id, inicio, fim: inicio.replace(':00:00', ':50:00'), status, modalidade, criado_em: '2029-09-01 10:00:00' });
const records = [appointment(1, '2030-09-18 14:00:00', 'confirmado'), appointment(2, '2030-09-12 09:00:00', 'agendado', 'presencial'), appointment(3, '2029-09-18 14:00:00', 'concluido'), appointment(4, '2030-09-15 14:00:00', 'cancelado'), appointment(5, '2028-09-18 14:00:00', 'concluido')];

async function seed(page, { admin = false, legacy = false } = {}) {
  await page.clock.setFixedTime(new Date('2030-09-10T15:00:00Z'));
  await page.addInitScript(({ patient, professional, admin, legacy }) => {
    if (sessionStorage.getItem('seeded-patient')) return;
    sessionStorage.setItem('seeded-patient', 'yes');
    localStorage.setItem(legacy ? 'psicologa_token' : 'paciente_token', 'patient-token');
    localStorage.setItem(legacy ? 'psicologa_usuario' : 'paciente_usuario', JSON.stringify(patient));
    if (admin) {
      localStorage.setItem('psicologa_token', 'admin-token');
      localStorage.setItem('psicologa_usuario', JSON.stringify(professional));
    }
  }, { patient, professional, admin, legacy });
}

async function mockApi(page, { items = records, listError = 0, cancelError = false, delay = 0 } = {}) {
  let stored = structuredClone(items);
  let lists = 0;
  let cancellations = 0;
  const requests = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ path: url.pathname, method: req.method() });
    if (url.pathname === '/api/usuario/agendamentos') {
      expect(req.headers().authorization).toBe('Bearer patient-token');
      lists++;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (listError && lists === 1) return route.fulfill({ status: listError, json: { erro: 'Serviço temporariamente indisponível.' } });
      return route.fulfill({ json: stored });
    }
    if (/\/api\/usuario\/agendamentos\/\d+\/cancelar$/.test(url.pathname)) {
      expect(req.method()).toBe('PATCH');
      expect(req.headers().authorization).toBe('Bearer patient-token');
      cancellations++;
      if (cancelError && cancellations === 1) return route.fulfill({ status: 503, json: { erro: 'Tente novamente em instantes.' } });
      const item = stored.find((item) => item.id === Number(url.pathname.split('/').at(-2)));
      item.status = 'cancelado';
      return route.fulfill({ json: { agendamento: item } });
    }
    if (url.pathname === '/api/pacientes/me') return route.fulfill({ json: { usuario: patient } });
    if (url.pathname === '/api/horarios') return route.fulfill({ json: { horarios: [{ horario: '09:00', fim: '09:50' }] } });
    if (url.pathname === '/api/agendamentos' && req.method() === 'POST') {
      expect(req.headers().authorization).toBe('Bearer patient-token');
      const body = req.postDataJSON();
      stored.push(appointment(99, `${body.data} ${body.horario}:00`, 'agendado', body.modalidade));
      return route.fulfill({ status: 201, json: { agendamento: { id: 99, ...body, horarioFim: '09:50' } } });
    }
    if (url.pathname === '/api/agendamentos') {
      expect(req.headers().authorization).toBe('Bearer admin-token');
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ status: 404, json: { erro: 'Rota não configurada no teste.' } });
  });
  return { requests, listCount: () => lists };
}

async function openUserMenu(page) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('button', { name: 'Joaquim', exact: true }).click();
}

test('rota privada volta ao destino após login e confirmação por e-mail', async ({ page }) => {
  await mockApi(page, { items: [] });
  await page.route('**/api/pacientes/login', (route) => route.fulfill({ json: { verificacaoPendente: true, desafio: 'a'.repeat(64), email: patient.email, expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 } }));
  await page.route('**/api/pacientes/verificar-email', (route) => route.fulfill({ json: { token: 'patient-token', usuario: patient } }));
  await page.goto('/minhas-consultas');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByLabel('Código de verificação').fill('123456');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/\/minhas-consultas$/);
  await expect(page.getByText('Você ainda não possui consultas agendadas.')).toBeVisible();
  await openUserMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Minhas consultas' })).toBeVisible();
});

test('menu existente mostra identidade, navega e encerra só a sessão do paciente', async ({ page }) => {
  await seed(page, { admin: true });
  await mockApi(page);
  await page.goto('/');
  await openUserMenu(page);
  await expect(page.locator('.user-menu-identity')).toContainText(patient.nome);
  await expect(page.locator('.user-menu-identity')).toContainText(patient.email);
  await page.getByRole('menuitem', { name: 'Minhas consultas' }).click();
  await expect(page).toHaveURL(/\/minhas-consultas$/);
  await expect(page.locator('.patient-appointment')).toHaveCount(5);
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: 'Minha conta' }).click();
  await expect(page).toHaveURL(/\/minha-conta$/);
  await expect(page.locator('.patient-account')).toContainText(patient.email);
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('paciente_usuario'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBe('admin-token');
  await page.goto('/adm/agenda');
  await expect(page.getByRole('heading', { name: 'Ainda não há atendimentos.' })).toBeVisible();
});

test('filtros instantâneos, contadores, ordem cronológica e detalhes em português', async ({ page }, testInfo) => {
  await seed(page);
  const api = await mockApi(page);
  await page.goto('/minhas-consultas');
  const cards = page.locator('.patient-appointment');
  await expect(cards).toHaveCount(5);
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.appointmentId))).toEqual(['2', '1', '4', '3', '5']);
  await page.getByRole('button', { name: /^Marcadas/ }).click();
  await expect(cards).toHaveCount(2);
  await cards.last().getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(cards.last()).toContainText('18 de setembro de 2030');
  await expect(cards.last()).toContainText('14:00 — 14:50');
  await expect(cards.last()).toContainText('Solicitada em');
  await expect(cards.last().locator('a')).toHaveCount(0);
  await page.getByRole('button', { name: /^Realizadas/ }).click();
  await expect(cards).toHaveCount(2);
  expect(await cards.first().getAttribute('data-appointment-id')).toBe('3');
  await page.getByRole('button', { name: /^Canceladas/ }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole('button', { name: /^Todas/ }).click();
  expect(api.listCount()).toBe(1);
  expect(api.requests.some((item) => item.path === '/api/agendamentos')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('minhas-consultas.png'), fullPage: true });
});

test('cancelamento com modal, Escape, foco, erro recuperável e atualização sem F5', async ({ page }) => {
  await seed(page);
  await mockApi(page, { cancelError: true });
  await page.goto('/minhas-consultas');
  await page.getByRole('button', { name: /^Marcadas/ }).click();
  const card = page.locator('[data-appointment-id="1"]');
  await card.getByRole('button', { name: 'Ver detalhes' }).click();
  const cancel = card.getByRole('button', { name: 'Cancelar consulta' });
  await cancel.click();
  const modal = page.getByRole('alertdialog');
  await expect(modal.getByRole('button', { name: 'Voltar' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Cancelar consulta' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(cancel).toBeFocused();
  await cancel.click();
  await modal.getByRole('button', { name: 'Cancelar consulta' }).click();
  await expect(modal.getByRole('alert')).toContainText('Tente novamente');
  await expect(card).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar consulta' }).click();
  await expect(modal).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Marcadas/ })).toContainText('01');
  await expect(page.getByRole('button', { name: /^Canceladas/ })).toContainText('02');
  await expect(page.getByRole('status')).toContainText('Consulta cancelada');
  await page.getByRole('button', { name: /^Canceladas/ }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(card.getByRole('button', { name: 'Cancelar consulta' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Canceladas/ })).toContainText('02');
});

test('JWT expirado limpa apenas a sessão do paciente e protege a rota', async ({ page }) => {
  await seed(page, { admin: true });
  await mockApi(page, { listError: 401 });
  await page.goto('/minhas-consultas');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBe('admin-token');
  await page.goto('/adm/agenda');
  await expect(page.getByRole('heading', { name: 'Ainda não há atendimentos.' })).toBeVisible();
});

test('carregamento, recuperação de erro, vazio e CTA para agendamento existente', async ({ page }) => {
  await seed(page);
  await mockApi(page, { items: [], listError: 503, delay: 350 });
  await page.goto('/minhas-consultas');
  await expect(page.getByRole('status')).toContainText('Buscando suas consultas');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Você ainda não possui consultas agendadas.')).toBeVisible();
  await page.locator('.patient-state').getByRole('link', { name: 'Agendar uma conversa' }).click();
  await expect(page).toHaveURL(/\/#agendamento$/);
  await expect(page.locator('#booking-title')).toBeInViewport();
});

test('nova reserva aparece nas consultas marcadas', async ({ page }) => {
  await seed(page);
  await mockApi(page, { items: [] });
  await page.goto('/#agendamento');
  await page.locator('[data-date="2030-09-18"]').click();
  await page.getByRole('button', { name: '09:00 até 09:50' }).click();
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agendamento realizado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar confirmação' }).click();
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: 'Minhas consultas' }).click();
  await page.getByRole('button', { name: /^Marcadas/ }).click();
  await expect(page.locator('[data-appointment-id="99"]')).toContainText('09:00 — 09:50');
});

test('sessão antiga migra e menu funciona por teclado', async ({ page }) => {
  await seed(page, { legacy: true });
  await mockApi(page);
  await page.goto('/minhas-consultas');
  await expect(page.locator('.patient-appointment')).toHaveCount(5);
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBe('patient-token');
  if (await page.getByRole('button', { name: 'Abrir menu' }).isVisible()) await page.getByRole('button', { name: 'Abrir menu' }).click();
  const trigger = page.getByRole('button', { name: 'Joaquim', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Minhas consultas' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('layout sem overflow em desktop, notebook, tablet e celular', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz de tamanhos executada uma vez.');
  await seed(page);
  await mockApi(page);
  await page.goto('/minhas-consultas');
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openUserMenu(page);
    await expect(page.getByRole('menuitem', { name: 'Minhas consultas' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('menuitem', { name: 'Minhas consultas' }).click();
    await page.screenshot({ path: testInfo.outputPath(`consultas-${width}.png`), fullPage: true });
  }
});

test('DATETIME mantém data e hora do consultório em outro fuso do navegador', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Pacific/Auckland', baseURL: 'http://127.0.0.1:4173' });
  const page = await context.newPage();
  try {
    await seed(page); await mockApi(page);
    await page.goto('/minhas-consultas');
    const card = page.locator('[data-appointment-id="1"]');
    await card.getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(card).toContainText('18 de setembro de 2030');
    await expect(card).toContainText('14:00 — 14:50');
  } finally { await context.close(); }
});
