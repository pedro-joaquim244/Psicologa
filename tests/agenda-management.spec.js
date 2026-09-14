import { test, expect } from '@playwright/test';

const day = '2030-09-18';
const professional = { id: 7, nome: 'Helena Martins', email: 'helena@example.com', tipo: 'psicologa', email_verificado: true };
const patient = { id: 2, nome: 'Paciente Teste', email: 'paciente@example.com', tipo: 'paciente', email_verificado: true };
const appointments = [
  { id: 1, nome_cliente: 'Marina Oliveira', inicio: `${day} 15:00:00`, fim: `${day} 15:50:00`, modalidade: 'online', status: 'agendado' },
  { id: 2, nome_cliente: 'Beatriz Costa', inicio: `${day} 12:00:00`, fim: `${day} 12:50:00`, modalidade: 'presencial', status: 'confirmado' },
  { id: 3, nome_cliente: 'Carla Souza', inicio: `${day} 13:00:00`, fim: `${day} 13:50:00`, modalidade: 'online', status: 'concluido' },
  { id: 4, nome_cliente: 'Daniela Lima', inicio: `${day} 07:00:00`, fim: `${day} 07:50:00`, modalidade: 'presencial', status: 'cancelado' },
];

async function seedSession(page, { admin = true, withPatient = false } = {}) {
  await page.clock.setFixedTime(new Date('2030-09-10T12:00:00'));
  await page.addInitScript(({ admin, withPatient, professional, patient }) => {
    if (admin) {
      localStorage.setItem('psicologa_token', 'agenda-admin-token');
      localStorage.setItem('psicologa_usuario', JSON.stringify(professional));
    }
    if (withPatient) {
      localStorage.setItem('paciente_token', 'agenda-patient-token');
      localStorage.setItem('paciente_usuario', JSON.stringify(patient));
    }
  }, { admin, withPatient, professional, patient });
}

async function mockAgenda(page) {
  const state = {
    recorrentes: [
      { id: 10, dia_semana: 3, hora_inicio: '08:00:00', hora_fim: '12:00:00', duracao_minutos: 50, intervalo_minutos: 10 },
      { id: 11, dia_semana: 3, hora_inicio: '14:00:00', hora_fim: '18:00:00', duracao_minutos: 50, intervalo_minutos: 10 },
    ],
    extras: [],
    bloqueios: [],
    requests: [],
    nextFailure: null,
    unauthorized: false,
    nextId: 100,
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/agendamentos' && method === 'GET') return json(appointments);
    if (url.pathname === '/api/agenda' && method === 'GET') {
      if (state.unauthorized) return json({ erro: 'Sessão expirada.' }, 401);
      const date = url.searchParams.get('data');
      const extras = state.extras.filter((item) => item.data === date);
      const bloqueios = state.bloqueios.filter((item) => item.data === date);
      const defaults = date === day ? ['08:00', '09:00', '10:00', '11:00', '14:00', '16:00', '17:00'].map((horario) => ({ horario, fim: `${horario.slice(0, 2)}:50` })) : [];
      const horarios = [...defaults, ...extras.map((item) => ({ horario: item.hora_inicio.slice(0, 5), fim: item.hora_fim.slice(0, 5) }))]
        .filter((slot) => !bloqueios.some((block) => slot.horario < block.hora_fim.slice(0, 5) && slot.fim > block.hora_inicio.slice(0, 5)))
        .sort((a, b) => a.horario.localeCompare(b.horario));
      return json({ data: date, profissional_id: 1, duracao_padrao: 50, intervalo_padrao: 10, recorrentes: state.recorrentes, extras, bloqueios, horarios });
    }

    const match = url.pathname.match(/^\/api\/agenda\/(disponibilidades|bloqueios)(?:\/(\d+))?$/);
    if (match && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      const [, resource, rawId] = match;
      const body = method === 'DELETE' ? null : request.postDataJSON();
      state.requests.push({ method, path: url.pathname, body, authorization: request.headers().authorization });
      if (state.nextFailure) {
        const failure = state.nextFailure;
        state.nextFailure = null;
        return json({ erro: failure.message }, failure.status);
      }
      const id = rawId ? Number(rawId) : state.nextId++;
      const key = resource === 'bloqueios' ? 'bloqueios' : body?.tipo === 'recorrente' || state.recorrentes.some((item) => item.id === id) ? 'recorrentes' : 'extras';
      if (method === 'DELETE') {
        state[key] = state[key].filter((item) => item.id !== id);
        return json({ mensagem: 'Horário excluído com sucesso.' });
      }
      const record = {
        id,
        ...body,
        hora_inicio: `${body.hora_inicio.slice(0, 5)}:00`,
        hora_fim: `${body.hora_fim.slice(0, 5)}:00`,
        ...(key === 'bloqueios'
          ? { inicio: `${body.data} ${body.hora_inicio.slice(0, 5)}:00`, fim: `${body.data} ${body.hora_fim.slice(0, 5)}:00` }
          : { duracao_minutos: Number(body.duracao_minutos ?? 50), intervalo_minutos: Number(body.intervalo_minutos ?? 10) }),
      };
      if (method === 'PATCH') state[key] = state[key].map((item) => item.id === id ? record : item);
      else state[key].push(record);
      return json({ mensagem: 'Horário salvo com sucesso.', [key === 'bloqueios' ? 'bloqueio' : 'disponibilidade']: record }, method === 'POST' ? 201 : 200);
    }
    return json({ erro: 'Rota não simulada.' }, 404);
  });
  return state;
}

async function openDay(page) {
  await page.goto('/adm/agenda');
  await page.getByRole('button', { name: 'Horários do dia', exact: true }).click();
  await page.getByLabel('Dia da agenda', { exact: true }).fill(day);
  await expect(page.getByLabel('Dia da agenda', { exact: true })).toHaveValue(day);
  await expect(page.locator('.schedule-timeline time').filter({ hasText: '08:00' }).first()).toBeVisible();
}

async function fillPeriod(dialog, { date = day, start = '18:00', end = '18:50' } = {}) {
  await dialog.getByLabel('Data', { exact: true }).fill(date);
  await dialog.getByLabel('Horário inicial', { exact: true }).fill(start);
  await dialog.getByLabel('Horário final', { exact: true }).fill(end);
}

function changes(page) {
  return page.getByRole('region', { name: 'Alterações deste dia', exact: true });
}

test('cria, edita e exclui horário extra mantendo a consulta existente', async ({ page }) => {
  await seedSession(page);
  const state = await mockAgenda(page);
  await openDay(page);
  await page.getByRole('button', { name: 'Novo horário', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Novo horário', exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Disponível', exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Motivo (opcional)', { exact: true })).toHaveCount(0);
  await fillPeriod(dialog);
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.requests.length).toBe(1);
  expect(state.requests[0]).toMatchObject({ method: 'POST', path: '/api/agenda/disponibilidades', authorization: 'Bearer agenda-admin-token', body: { tipo: 'extra', data: day, hora_inicio: '18:00', hora_fim: '18:50' } });
  let card = changes(page).getByRole('article').filter({ hasText: '18:00' });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialog.getByLabel('Horário inicial', { exact: true })).toHaveValue('18:00');
  await dialog.getByLabel('Horário inicial', { exact: true }).fill('19:00');
  await dialog.getByLabel('Horário final', { exact: true }).fill('19:50');
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog).toBeHidden();
  card = changes(page).getByRole('article').filter({ hasText: '19:00' });
  await expect(card).toHaveCount(1);
  await expect(changes(page).getByText(/18:00/)).toHaveCount(0);
  await card.getByRole('button', { name: 'Excluir', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByRole('heading', { name: 'Excluir horário?', exact: true })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(changes(page).getByRole('article')).toHaveCount(0);
  expect(state.requests.map((item) => item.method)).toEqual(['POST', 'PATCH', 'DELETE']);
  expect(state.requests[1].path).toBe('/api/agenda/disponibilidades/100');
  expect(state.requests[2].path).toBe('/api/agenda/disponibilidades/100');
  await page.getByRole('button', { name: 'Atendimentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Marina Oliveira', exact: true })).toBeVisible();
});

test('cria, edita e remove bloqueio com motivo privado na agenda', async ({ page }) => {
  await seedSession(page);
  const state = await mockAgenda(page);
  await openDay(page);
  await page.getByRole('button', { name: 'Novo horário', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Ocupado', exact: true }).check();
  await fillPeriod(dialog, { start: '14:00', end: '14:50' });
  await dialog.getByLabel('Motivo (opcional)', { exact: true }).fill('Compromisso pessoal');
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog).toBeHidden();
  let card = changes(page).getByRole('article').filter({ hasText: 'Compromisso pessoal' });
  await expect(card.getByText('Ocupado', { exact: true })).toBeVisible();
  expect(state.requests[0]).toMatchObject({ method: 'POST', path: '/api/agenda/bloqueios', body: { data: day, hora_inicio: '14:00', hora_fim: '14:50', motivo: 'Compromisso pessoal' } });
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialog.getByLabel('Motivo (opcional)', { exact: true })).toHaveValue('Compromisso pessoal');
  await dialog.getByLabel('Horário inicial', { exact: true }).fill('16:00');
  await dialog.getByLabel('Horário final', { exact: true }).fill('17:50');
  await dialog.getByLabel('Motivo (opcional)', { exact: true }).fill('Reunião de supervisão');
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog).toBeHidden();
  card = changes(page).getByRole('article').filter({ hasText: 'Reunião de supervisão' });
  await expect(card).toContainText('16:00');
  await card.getByRole('button', { name: 'Excluir', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByRole('heading', { name: 'Excluir bloqueio?', exact: true })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(changes(page).getByRole('article')).toHaveCount(0);
  expect(state.requests.map((item) => item.method)).toEqual(['POST', 'PATCH', 'DELETE']);
  expect(state.requests.slice(1).map((item) => item.path)).toEqual(['/api/agenda/bloqueios/100', '/api/agenda/bloqueios/100']);
});

test('administra um período semanal com duração e intervalo próprios', async ({ page }) => {
  await seedSession(page);
  const state = await mockAgenda(page);
  await page.goto('/adm/agenda');
  await page.getByRole('button', { name: 'Rotina semanal', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar período', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Novo período semanal', exact: true })).toBeVisible();
  await dialog.getByLabel('Dia da semana', { exact: true }).selectOption('1');
  await dialog.getByLabel('Horário inicial', { exact: true }).fill('18:00');
  await dialog.getByLabel('Horário final', { exact: true }).fill('20:00');
  await dialog.getByLabel('Duração da consulta (min)', { exact: true }).fill('40');
  await dialog.getByLabel('Intervalo entre consultas (min)', { exact: true }).fill('20');
  await expect(dialog.getByLabel('Data', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Salvar período', exact: true }).click();
  await expect(dialog).toBeHidden();
  let card = page.getByRole('article').filter({ hasText: '18:00' });
  await expect(card).toHaveCount(1);
  expect(state.requests[0]).toMatchObject({ method: 'POST', path: '/api/agenda/disponibilidades', body: { tipo: 'recorrente', dia_semana: 1, hora_inicio: '18:00', hora_fim: '20:00', duracao_minutos: 40, intervalo_minutos: 20 } });
  expect(state.requests[0].body).not.toHaveProperty('data');
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialog.getByLabel('Duração da consulta (min)', { exact: true })).toHaveValue('40');
  await expect(dialog.getByLabel('Intervalo entre consultas (min)', { exact: true })).toHaveValue('20');
  await dialog.getByLabel('Horário final', { exact: true }).fill('21:00');
  await dialog.getByRole('button', { name: 'Salvar período', exact: true }).click();
  await expect(dialog).toBeHidden();
  card = page.getByRole('article').filter({ hasText: '21:00' });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByRole('article').filter({ hasText: '21:00' })).toHaveCount(0);
  expect(state.recorrentes).toHaveLength(2);
  expect(state.requests.map((item) => item.method)).toEqual(['POST', 'PATCH', 'DELETE']);
});

test('conflito 409 preserva os campos e permite corrigir o período sem cancelar a consulta', async ({ page }) => {
  await seedSession(page);
  const state = await mockAgenda(page);
  await openDay(page);
  await page.getByRole('button', { name: 'Novo horário', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Ocupado', exact: true }).check();
  await fillPeriod(dialog, { start: '15:00', end: '15:50' });
  await dialog.getByLabel('Motivo (opcional)', { exact: true }).fill('Compromisso pessoal');
  state.nextFailure = { status: 409, message: 'Existe uma consulta marcada neste período.' };
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Existe uma consulta marcada neste período.');
  await expect(dialog.getByLabel('Horário inicial', { exact: true })).toHaveValue('15:00');
  await expect(dialog.getByLabel('Motivo (opcional)', { exact: true })).toHaveValue('Compromisso pessoal');
  await expect(dialog.getByRole('button', { name: 'Salvar horário', exact: true })).toBeEnabled();
  expect(state.bloqueios).toHaveLength(0);
  expect(state.requests).toHaveLength(1);
  await dialog.getByLabel('Horário inicial', { exact: true }).fill('18:00');
  await dialog.getByLabel('Horário final', { exact: true }).fill('18:50');
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(changes(page).getByRole('article')).toHaveCount(1);
  expect(state.requests.every((item) => item.path === '/api/agenda/bloqueios' && item.method === 'POST')).toBe(true);
  await page.getByRole('button', { name: 'Atendimentos', exact: true }).click();
  const appointment = page.getByRole('article').filter({ hasText: 'Marina Oliveira' });
  await expect(appointment.getByText('Agendado', { exact: true })).toBeVisible();
});

test('modal mantém navegação por teclado e devolve o foco ao fechar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Teclado validado uma vez.');
  await seedSession(page);
  await mockAgenda(page);
  await openDay(page);
  const trigger = page.getByRole('button', { name: 'Novo horário', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Salvar horário', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('views e formulários cabem em celular, tablet e notebook', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz responsiva executada uma vez.');
  await seedSession(page);
  await mockAgenda(page);
  await openDay(page);
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    for (const view of ['Atendimentos', 'Horários do dia', 'Rotina semanal']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Novo horário', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Ocupado', exact: true }).check();
    await expect(dialog.getByLabel('Motivo (opcional)', { exact: true })).toBeVisible();
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    }).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar período', exact: true }).click();
    await expect(dialog.getByLabel('Duração da consulta (min)', { exact: true })).toBeVisible();
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    }).toBe(true);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
});

test('401 do controle de horários encerra só a sessão administrativa', async ({ page }) => {
  await seedSession(page, { withPatient: true });
  const state = await mockAgenda(page);
  await openDay(page);
  state.unauthorized = true;
  await page.getByLabel('Dia da agenda', { exact: true }).fill('2030-09-19');
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect.poll(() => page.evaluate(() => ({
    adminToken: localStorage.getItem('psicologa_token'),
    adminUser: localStorage.getItem('psicologa_usuario'),
    patientToken: localStorage.getItem('paciente_token'),
  }))).toEqual({ adminToken: null, adminUser: null, patientToken: 'agenda-patient-token' });
});

test('paciente não vê controles administrativos nem consulta endpoints da agenda', async ({ page }) => {
  await seedSession(page, { admin: false, withPatient: true });
  const requests = [];
  await page.route('**/api/**', (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ erro: 'Acesso restrito.' }) });
  });
  await page.goto('/adm/agenda');
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect(page.getByRole('button', { name: 'Novo horário', exact: true })).toHaveCount(0);
  expect(requests.filter((path) => path.startsWith('/api/agenda'))).toEqual([]);
});
