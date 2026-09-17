import { test, expect } from '@playwright/test';

const patient = { id: 1, nome: 'Paciente', tipo: 'paciente', email: 'paciente@example.com', telefone: '16999998888', email_verificado: true };

test('confirma no cadastro uma vez e o login futuro entra direto sem novo código', async ({ page }, testInfo) => {
  await page.clock.install();
  let generation = 'a';
  let loginRequests = 0;
  let emailRequests = 0;
  const challenge = () => ({ verificacaoPendente: true, desafio: generation.repeat(64), email: patient.email, expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 });
  await page.route('**/api/pacientes/cadastro', (route) => { emailRequests++; return route.fulfill({ status: 201, json: challenge() }); });
  await page.route('**/api/pacientes/login', (route) => {
    loginRequests++;
    return route.fulfill({ json: { mensagem: 'Login realizado com sucesso!', token: 'future-login-token', usuario: patient } });
  });
  await page.route('**/api/pacientes/reenviar-codigo', (route) => {
    expect(route.request().postDataJSON()).toEqual({ desafio: generation.repeat(64) });
    generation = 'b'; emailRequests++;
    return route.fulfill({ json: challenge() });
  });
  await page.route('**/api/pacientes/verificar-email', (route) => {
    const body = route.request().postDataJSON();
    expect(body.desafio).toBe(generation.repeat(64));
    return route.fulfill(body.codigo === '012345'
      ? { json: { token: 'verified-token', usuario: patient } }
      : { status: 400, json: { erro: 'Código incorreto. Confira o e-mail e tente novamente.' } });
  });
  await page.route('**/api/horarios?*', (route) => route.fulfill({ json: { horarios: [] } }));

  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill(patient.nome);
  await page.getByLabel('WhatsApp com DDD').fill(patient.telefone);
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail.' })).toBeVisible();
  await expect(page.getByLabel('Código de verificação')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBeNull();
  await expect(page.getByRole('button', { name: /Reenviar código/ })).toBeDisabled();
  await page.getByLabel('Código de verificação').fill('111111');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Código incorreto');
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Reenviar código', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Novo código enviado');
  await expect(page.getByLabel('Código de verificação')).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('verificacao-email.png'), fullPage: true });
  await page.getByLabel('Código de verificação').fill('012345');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/#agendamento$/);
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBe('verified-token');

  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('button', { name: /Paciente/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/#agendamento$/);
  await expect(page.getByLabel('Código de verificação')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBe('future-login-token');
  expect(loginRequests).toBe(1);
  expect(emailRequests).toBe(2);
});

test('conta não verificada sem desafio só envia código após o clique em reenviar', async ({ page }) => {
  let resendRequests = 0;
  await page.route('**/api/pacientes/login', (route) => route.fulfill({
    status: 403,
    json: { erro: 'Confirme seu e-mail antes de entrar.', codigo: 'EMAIL_NAO_VERIFICADO' },
  }));
  await page.route('**/api/pacientes/reenviar-codigo', (route) => {
    resendRequests++;
    expect(route.request().postDataJSON()).toEqual({ email: patient.email, senha: 'Senha123456' });
    return route.fulfill({ json: { verificacaoPendente: true, desafio: 'a'.repeat(64), email: patient.email, expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 } });
  });
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Confirme seu e-mail antes de entrar');
  expect(resendRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBeNull();
  await page.getByRole('button', { name: 'Reenviar código', exact: true }).click();
  expect(resendRequests).toBe(1);
  await expect(page.getByLabel('Código de verificação')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Código enviado');
});

test('profissional não verificada também é orientada a confirmar o e-mail', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 403,
    json: { erro: 'Confirme seu e-mail antes de entrar.', codigo: 'EMAIL_NAO_VERIFICADO' },
  }));
  await page.route('**/api/auth/reenviar-codigo', (route) => route.fulfill({ json: {
    verificacaoPendente: true, desafio: 'a'.repeat(64), email: 'psicologa@example.com',
    expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000,
  } }));
  await page.goto('/adm/login');
  await page.getByLabel('E-mail', { exact: true }).fill('psicologa@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaProfissional123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Confirme seu e-mail antes de entrar');
  await page.getByRole('button', { name: 'Reenviar código', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
});

test('429 mostra mensagem da API e não repete automaticamente o login', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A resposta do cliente HTTP é coberta uma vez.');
  let requests = 0;
  await page.route('**/api/auth/login', (route) => {
    requests += 1;
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': '60' },
      json: { erro: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.', codigo: 'RATE_LIMIT' },
    });
  });
  await page.goto('/adm/login');
  await page.getByLabel('E-mail', { exact: true }).fill('psicologa@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaProfissional123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Muitas tentativas de acesso');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await page.waitForTimeout(300);
  expect(requests).toBe(1);
});

test('desafio pendente expirado permite tentar reenvio sem criar sessão', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/pacientes/login', (route) => route.fulfill({ status: 403, json: {
    erro: 'Confirme seu e-mail antes de entrar.', codigo: 'EMAIL_NAO_VERIFICADO', verificacaoPendente: true,
    desafio: 'a'.repeat(64), email: patient.email, expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000,
  } }));
  await page.route('**/api/pacientes/reenviar-codigo', (route) => route.fulfill({ status: 503, json: { erro: 'Não foi possível enviar o código.' } }));
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(patient.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Código de verificação')).toBeVisible();
  await page.clock.fastForward(601000);
  await expect(page.getByText('Código expirado. Solicite um novo código abaixo.')).toBeVisible();
  await page.getByLabel('Código de verificação').fill('123456');
  await expect(page.getByRole('button', { name: 'Confirmar e entrar' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reenviar código', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível enviar');
  await page.getByRole('button', { name: 'Voltar para o login' }).click();
  expect(await page.evaluate(() => localStorage.getItem('paciente_token'))).toBeNull();
});
