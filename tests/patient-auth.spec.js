import { test, expect } from '@playwright/test';

const patient = { id: 2, nome: 'Paciente Teste', telefone: '16999998888', email: 'paciente@example.com', tipo: 'paciente' };

test('login visível oferece os dois perfis e cadastro', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Seu próximo passo.' })).toBeVisible();
  await page.getByRole('link', { name: 'Sou psicóloga' }).click();
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect(page.getByRole('heading', { name: 'Bem-vinda de volta.' })).toBeVisible();
  await page.getByRole('link', { name: 'Sou paciente' }).click();
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crie sua conta.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('cadastro.png'), fullPage: true });
});

test('paciente não abre agenda administrativa nem consulta a lista de pacientes', async ({ page }) => {
  await page.addInitScript((user) => {
    localStorage.setItem('psicologa_token', 'patient-token');
    localStorage.setItem('psicologa_usuario', JSON.stringify(user));
  }, patient);
  let adminRequests = 0;
  await page.route('**/api/agendamentos', (route) => { adminRequests++; return route.abort(); });
  await page.goto('/adm/agenda');
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  expect(adminRequests).toBe(0);
});

test('login inválido e cadastro duplicado mostram erro sem criar sessão', async ({ page }) => {
  await page.route('**/api/pacientes/login', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ erro: 'E-mail ou senha incorretos.' }) }));
  await page.route('**/api/pacientes/cadastro', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ erro: 'Já existe uma conta com esse e-mail.' }) }));
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha não conferem');
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Nome completo').fill(patient.nome);
  await page.getByLabel('WhatsApp com DDD').fill(patient.telefone);
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe uma conta');
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
});

test('reserva exige novo login quando a sessão expira', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-09-10T12:00:00'));
  await page.addInitScript((user) => {
    localStorage.setItem('psicologa_token', 'expired-patient-token');
    localStorage.setItem('psicologa_usuario', JSON.stringify(user));
  }, patient);
  await page.route('**/api/horarios?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ horarios: [{ horario: '09:00', fim: '09:50' }] }) }));
  await page.route('**/api/agendamentos', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ erro: 'Sessão expirada.' }) }));
  await page.goto('/#agendamento');
  await page.locator('[data-date="2030-09-18"]').click();
  await page.getByRole('button', { name: '09:00 até 09:50' }).click();
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Entrar como paciente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar agendamento', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
});
