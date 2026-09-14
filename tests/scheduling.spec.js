import { test, expect } from '@playwright/test';

const api = '**/api';
const selectedDate = '2030-09-18';
const slots = [{ horario: '09:00', fim: '09:50' }, { horario: '15:00', fim: '15:50' }];
const user = { id: 1, nome: 'Dra. Helena Martins', tipo: 'psicologa' };
const patient = { id: 7, nome: 'Teste Integração', telefone: '16999998888', email: 'teste@example.com', tipo: 'paciente' };

async function setup(page, { conflict = false, availabilityError = false, authenticated = true } = {}) {
  await page.clock.setFixedTime(new Date('2030-09-10T12:00:00'));
  if (authenticated) await page.addInitScript((user) => {
    localStorage.setItem('psicologa_token', 'patient-jwt');
    localStorage.setItem('psicologa_usuario', JSON.stringify(user));
  }, patient);
  let record;
  let booked = false;
  let gets = 0;
  const requests = [];
  await page.route(`${api}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ method: req.method(), path: url.pathname, authorization: req.headers().authorization });
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/horarios') {
      gets++;
      if (availabilityError && gets === 1) return json({ erro: 'Disponibilidade temporariamente indisponível.' }, 503);
      return json({ data: url.searchParams.get('data'), horarios: booked ? slots.slice(1) : slots });
    }
    if (url.pathname === '/api/agendamentos' && req.method() === 'POST') {
      expect(req.headers().authorization).toBe('Bearer patient-jwt');
      expect(req.headers()['content-type']).toContain('application/json');
      const body = req.postDataJSON();
      expect(body).toMatchObject({ nome: 'Teste Integração', telefone: '16999998888', data: selectedDate, horario: '09:00', modalidade: 'online' });
      booked = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (conflict) return json({ erro: 'Este horário já foi reservado.' }, 409);
      record = { id: 123, nome_cliente: body.nome, telefone_cliente: body.telefone, email_cliente: body.email, modalidade: body.modalidade, inicio: `${body.data} ${body.horario}:00`, fim: `${body.data} 09:50:00`, status: 'agendado' };
      return json({ agendamento: { id: 123, ...body, horarioFim: '09:50' } }, 201);
    }
    if (['/api/auth/login', '/api/pacientes/cadastro', '/api/pacientes/login'].includes(url.pathname)) return json({ verificacaoPendente: true, desafio: 'a'.repeat(64), email: patient.email, expiraEm: new Date('2030-09-10T12:10:00').getTime(), reenviarEm: new Date('2030-09-10T12:01:00').getTime() });
    if (url.pathname === '/api/auth/verificar-email') return json({ token: 'test-jwt', usuario: { ...user, email_verificado: true } });
    if (url.pathname === '/api/pacientes/verificar-email') return json({ token: 'patient-jwt', usuario: { ...patient, email_verificado: true } });
    expect(req.headers().authorization).toBe('Bearer test-jwt');
    if (req.method() === 'PATCH') { record.status = url.pathname.endsWith('/concluir') ? 'concluido' : 'confirmado'; return json({ mensagem: 'Status atualizado' }); }
    return json(record ? [record] : []);
  });
  return requests;
}

async function selectAndFill(page) {
  await page.locator(`[data-date="${selectedDate}"]`).click();
  await page.getByRole('button', { name: '09:00 até 09:50' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Teste Integração');
}

test('paciente cria conta, reserva e psicóloga confirma no painel', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests = await setup(page, { authenticated: false });
  await page.goto('/');
  await page.locator('#inicio').getByRole('link', { name: 'Agendar uma conversa', exact: true }).click();
  await expect(page).toHaveURL(/#agendamento$/);
  await page.locator(`[data-date="${selectedDate}"]`).click();
  await page.getByRole('button', { name: '09:00 até 09:50' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar agendamento', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Nome completo').fill(patient.nome);
  await page.getByLabel('WhatsApp com DDD').fill(patient.telefone);
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123!');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Código de verificação').fill('123456');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/#agendamento$/);
  await expect(page.getByLabel('Nome completo')).toHaveValue(patient.nome);
  await expect(page.locator('.booking-summary')).toContainText('18 de setembro de 2030');
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reservando seu horário…' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Agendamento realizado', exact: true })).toBeVisible();
  expect(requests.filter((r) => r.method === 'GET' && r.path === '/api/agendamentos')).toHaveLength(0);
  expect(requests.filter((r) => r.method === 'POST' && r.path === '/api/agendamentos')).toHaveLength(1);
  await page.getByRole('button', { name: 'Fechar confirmação' }).click();
  await page.locator(`[data-date="${selectedDate}"]`).click();
  await expect(page.getByRole('button', { name: '09:00 até 09:50' })).toHaveCount(0);
  await page.getByRole('button', { name: '15:00 até 15:50' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue(patient.nome);

  await page.getByRole('link', { name: 'Área profissional' }).click();
  await expect(page).toHaveURL(/\/adm\/login$/);
  await page.getByLabel('E-mail', { exact: true }).fill('psicologa@email.com');
  await page.getByLabel('Senha', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByLabel('Código de verificação').fill('123456');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/\/adm\/agenda$/);
  const appointment = page.getByRole('article').filter({ hasText: 'Teste Integração' });
  await expect(appointment).toBeVisible();
  await appointment.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(appointment.getByText('Confirmado', { exact: true })).toBeVisible();
  await appointment.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(appointment.getByText('Concluído', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/adm\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
  await page.goto('/adm/agenda');
  await expect(page).toHaveURL(/\/adm\/login$/);
  expect(errors).toEqual([]);
});

test('conflito atualiza os horários e preserva os dados preenchidos', async ({ page }) => {
  await setup(page, { conflict: true });
  await page.goto('/#agendamento');
  await selectAndFill(page);
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Esse horário acabou de ser reservado. Escolha outro horário.');
  await expect(page.getByRole('button', { name: '09:00 até 09:50' })).toHaveCount(0);
  await page.getByRole('button', { name: '15:00 até 15:50' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue('Teste Integração');
});

test('calendário acessível, validação e recuperação de erro', async ({ page }) => {
  await setup(page, { availabilityError: true });
  await page.goto('/#agendamento');
  await expect(page.locator('[data-date="2030-09-09"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
  const today = page.locator('[data-date="2030-09-10"]');
  await today.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-date="2030-09-11"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Disponibilidade temporariamente indisponível.');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.getByRole('button', { name: '09:00 até 09:50' }).click();
  await expect(page.getByLabel('Nome completo')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page.getByRole('heading', { name: 'outubro de 2030' })).toBeVisible();
});

test('ignora resposta antiga após mudar a data e mostra disponibilidade vazia', async ({ page }) => {
  await setup(page);
  await page.route(`${api}/horarios?*`, async (route) => {
    const date = new URL(route.request().url()).searchParams.get('data');
    if (date === '2030-09-18') await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ horarios: date === '2030-09-18' ? slots : [] }) });
  });
  await page.goto('/#agendamento');
  await page.locator('[data-date="2030-09-18"]').click();
  await expect(page.getByRole('status')).toContainText('Buscando horários');
  await page.locator('[data-date="2030-09-19"]').click();
  await expect(page.getByText('Não há horários disponíveis para esta data.')).toBeVisible();
  await expect(page.getByRole('button', { name: '09:00 até 09:50' })).toHaveCount(0);
});

test('calendário e formulário cabem em celular, tablet e desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz executada uma vez.');
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#agendamento');
  await selectAndFill(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const clipped = await page.locator('#agendamento button, #agendamento input').evaluateAll((elements) => elements.some((el) => el.getBoundingClientRect().right > innerWidth || el.scrollWidth > el.clientWidth + 2));
    expect(clipped).toBe(false);
    if (width === 390 || width === 1440) await page.locator('#agendamento').screenshot({ path: testInfo.outputPath(`booking-${width}.png`), style: '.site-header { visibility: hidden; } html { scroll-behavior: auto !important; }' });
  }
});

test('presencial e erro de envio com nova tentativa', async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route(`${api}/agendamentos`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.email).toBe(patient.email);
    expect(body.modalidade).toBe('presencial');
    attempts++;
    await route.fulfill({ status: attempts === 1 ? 500 : 201, contentType: 'application/json', body: JSON.stringify(attempts === 1 ? { erro: 'Não foi possível realizar a reserva.' } : { agendamento: { id: 5, ...body, horarioFim: '09:50' } }) });
  });
  await page.goto('/#agendamento');
  await selectAndFill(page);
  await page.getByRole('radio', { name: 'Presencial', exact: true }).first().check();
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível realizar a reserva.');
  await expect(page.getByLabel('Nome completo')).toHaveValue('Teste Integração');
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agendamento realizado', exact: true })).toBeVisible();
});
