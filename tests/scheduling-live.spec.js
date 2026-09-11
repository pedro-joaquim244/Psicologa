import { test, expect } from '@playwright/test';
import { localDateKey } from '../src/utils/scheduling.js';

// Opt-in: creates one clearly identified test reservation and cancels only it.
test.use({ trace: 'off' });
test('fluxo real: reservar, consultar, confirmar e sair', async ({ page, request }, testInfo) => {
  test.skip(!process.env.REAL_BOOKING || !process.env.REAL_ADMIN_TOKEN || !process.env.REAL_PATIENT_TOKEN || testInfo.project.name !== 'desktop', 'Requer REAL_BOOKING=1 e tokens de contas de teste já confirmadas por e-mail.');
  const api = 'http://localhost:3333/api';
  const token = process.env.REAL_ADMIN_TOKEN;
  const patientToken = process.env.REAL_PATIENT_TOKEN;
  const me = await request.get(`${api}/pacientes/me`, { headers: { Authorization: `Bearer ${patientToken}` } });
  expect(me.ok()).toBeTruthy();
  const { usuario: patient } = await me.json();
  const adminCheck = await request.get(`${api}/agendamentos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(adminCheck.ok()).toBeTruthy();
  await page.addInitScript(({ token, user }) => {
    if (!sessionStorage.getItem('test-session-initialized')) {
      localStorage.setItem('psicologa_token', token);
      localStorage.setItem('psicologa_usuario', JSON.stringify(user));
      sessionStorage.setItem('test-session-initialized', '1');
    }
  }, { token: patientToken, user: patient });
  let id;
  try {
    let date;
    let slot;
    for (let offset = 1; offset <= 14; offset++) {
      const candidate = new Date();
      candidate.setDate(candidate.getDate() + offset);
      const key = localDateKey(candidate);
      const response = await request.get(`${api}/horarios?data=${key}`);
      expect(response.ok()).toBeTruthy();
      const { horarios } = await response.json();
      if (horarios.length) { date = key; slot = horarios[0]; break; }
    }
    expect(date, 'Precisa haver um horário livre nos próximos 14 dias.').toBeTruthy();
    await page.goto('http://localhost:5173/');
    await page.getByRole('link', { name: 'Agendar uma conversa', exact: true }).click();
    if (date.slice(0, 7) !== localDateKey().slice(0, 7)) await page.getByRole('button', { name: 'Próximo mês' }).click();
    await page.locator(`[data-date="${date}"]`).click();
    await page.getByRole('button', { name: `${slot.horario} até ${slot.fim}`, exact: true }).click();
    const name = patient.nome;
    await expect(page.getByLabel('Nome completo')).toHaveValue(name);
    const unauthenticated = await request.post(`${api}/agendamentos`, { data: {} });
    expect(unauthenticated.status()).toBe(401);
    const unauthorized = await request.get(`${api}/agendamentos`, { headers: { Authorization: `Bearer ${patientToken}` } });
    expect(unauthorized.status()).toBe(403);
    const creation = page.waitForResponse((r) => r.url() === `${api}/agendamentos` && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
    const response = await creation;
    const result = await response.json();
    id = result.agendamento?.id;
    expect(response.status()).toBe(201);
    expect(result.agendamento.nome).toBe(name);
    await expect(page.getByRole('heading', { name: 'Agendamento realizado', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar confirmação' }).click();
    await page.locator(`[data-date="${date}"]`).click();
    await expect(page.getByText('Buscando horários disponíveis…')).toBeHidden();
    await expect(page.getByRole('button', { name: `${slot.horario} até ${slot.fim}`, exact: true })).toHaveCount(0);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('psicologa_token', token);
      localStorage.setItem('psicologa_usuario', JSON.stringify(user));
    }, { token, user: { ...claims, nome: 'Profissional de teste' } });
    await page.goto('http://localhost:5173/adm/agenda');
    await expect(page).toHaveURL(/\/adm\/agenda$/);
    const item = page.getByRole('article').filter({ hasText: name }).filter({ hasText: slot.horario }).first();
    await expect(item).toBeVisible();
    await page.route('**/api/agendamentos/*/confirmar', async route => {
      if (new URL(route.request().url()).pathname !== `/api/agendamentos/${id}/confirmar`) {
        await route.abort();
        throw new Error('O teste tentou confirmar uma reserva diferente da que criou.');
      }
      await route.continue();
    });
    await item.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(item.getByText('Confirmado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/adm\/login$/);
    await page.goto('http://localhost:5173/adm/agenda');
    await expect(page).toHaveURL(/\/adm\/login$/);
  } finally {
    if (id) {
      const cleanup = await request.patch(`${api}/agendamentos/${id}/cancelar`, { headers: { Authorization: `Bearer ${token}` } });
      expect(cleanup.ok(), `Cancelar reserva de teste ${id}`).toBeTruthy();
    }
  }
});
