import { test, expect } from '@playwright/test';

const appointments = [
  {
    id: 1,
    nome_cliente: 'Marina Oliveira',
    email_cliente: 'marina@example.com',
    telefone_cliente: '16999998888',
    inicio: '2030-10-14 09:00:00',
    fim: '2030-10-14 10:00:00',
    modalidade: 'online',
    status: 'agendado',
  },
  {
    id: 2,
    nome_cliente: 'Beatriz Costa',
    email_cliente: 'beatriz@example.com',
    telefone_cliente: '1633334444',
    inicio: '2030-10-15 14:30:00',
    fim: '2030-10-15 15:30:00',
    modalidade: 'presencial',
    status: 'confirmado',
  },
  {
    id: 3,
    nome_cliente: 'Carla Souza',
    email_cliente: 'carla@example.com',
    telefone_cliente: '16988887777',
    inicio: '2030-10-16 11:00:00',
    fim: '2030-10-16 12:00:00',
    modalidade: 'online',
    status: 'concluido',
  },
];

async function mockAuthenticatedSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('psicologa_token', 'token-de-teste');
    localStorage.setItem('psicologa_usuario', JSON.stringify({ id: 7, nome: 'Helena Martins', email: 'psicologa@email.com', tipo: 'admin' }));
  });
}

async function mockApi(page, records = appointments) {
  await page.route('http://localhost:3333/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/login') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ verificacaoPendente: true, desafio: 'a'.repeat(64), email: 'psicologa@email.com', expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 }) });
    }
    if (url.pathname === '/api/auth/verificar-email') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'token-de-teste', usuario: { id: 7, nome: 'Helena Martins', email: 'psicologa@email.com', tipo: 'admin', email_verificado: true } }),
      });
      return;
    }

    if (url.pathname === '/api/agendamentos' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(records) });
      return;
    }

    const actionMatch = url.pathname.match(/^\/api\/agendamentos\/(\d+)\/(confirmar|concluir|cancelar)$/);
    if (actionMatch && request.method() === 'PATCH') {
      const [, id, action] = actionMatch;
      const current = records.find((item) => String(item.id) === id);
      const status = { confirmar: 'confirmado', concluir: 'concluido', cancelar: 'cancelado' }[action];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agendamento: { ...current, status } }) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Rota não simulada' }) });
  });
}

test('protege a agenda e autentica mantendo a sessão', async ({ page }) => {
  await mockApi(page);
  await page.goto('/adm/agenda');
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect(page.getByRole('heading', { name: /Bem-vinda/ })).toBeVisible();

  await page.getByLabel('E-mail').fill('psicologa@email.com');
  await page.getByLabel('Senha', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
  await page.getByLabel('Código de verificação').fill('123456');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();

  await expect(page).toHaveURL(/\/adm\/agenda$/);
  await expect(page.getByRole('heading', { name: 'Olá, Helena.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marina Oliveira' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    token: localStorage.getItem('psicologa_token'),
    user: JSON.parse(localStorage.getItem('psicologa_usuario') || 'null')?.nome,
  }))).toEqual({ token: 'token-de-teste', user: 'Helena Martins' });
});

test('filtra atendimentos por status, modalidade e nome', async ({ page }) => {
  await mockAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/adm/agenda');
  await expect(page.getByText('3 resultados')).toBeVisible();

  await page.getByRole('button', { name: 'Confirmado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beatriz Costa' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marina Oliveira' })).toBeHidden();

  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByLabel('Modalidade').selectOption('online');
  await page.getByLabel('Buscar por nome').fill('carla');
  await expect(page.getByText('1 resultado')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Carla Souza' })).toBeVisible();
});

test('confirma e cancela agendamentos com retorno visual', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fluxo completo executado uma vez.');
  await mockAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/adm/agenda');

  const marina = page.getByRole('article').filter({ hasText: 'Marina Oliveira' });
  await marina.getByRole('button', { name: 'Confirmar' }).click();
  await expect(marina.getByText('Confirmado', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('confirmado com sucesso');

  const cancelButton = marina.getByRole('button', { name: 'Cancelar' });
  await cancelButton.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Voltar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(cancelButton).toBeFocused();

  await cancelButton.click();
  await dialog.getByRole('button', { name: 'Cancelar agendamento' }).click();
  await expect(marina.getByText('Cancelado', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('cancelado com sucesso');
});

test('limpa a sessão quando a API informa token expirado', async ({ page }) => {
  await mockAuthenticatedSession(page);
  await page.route('http://localhost:3333/api/agendamentos', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ mensagem: 'Sessão expirada' }),
  }));

  await page.goto('/adm/agenda');
  await expect(page).toHaveURL(/\/adm\/login$/);
  await expect.poll(() => page.evaluate(() => ({
    token: localStorage.getItem('psicologa_token'),
    user: localStorage.getItem('psicologa_usuario'),
  }))).toEqual({ token: null, user: null });
});

test('oferece nova tentativa e apresenta a agenda vazia', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Estados auxiliares executados uma vez.');
  await mockAuthenticatedSession(page);
  let attempts = 0;
  await page.route('http://localhost:3333/api/agendamentos', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Falha temporária' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/adm/agenda');
  await expect(page.getByRole('alert')).toContainText('Falha temporária');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('heading', { name: 'Ainda não há atendimentos.' })).toBeVisible();
});

test('agenda não cria rolagem horizontal nos tamanhos principais', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz de tamanhos executada uma vez.');
  await mockAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/adm/agenda');
  await expect(page.getByRole('heading', { name: 'Marina Oliveira' })).toBeVisible();

  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('integração de leitura com a API local', async ({ page, request }, testInfo) => {
  test.skip(!process.env.REAL_API || !process.env.REAL_ADMIN_TOKEN || testInfo.project.name !== 'desktop', 'Requer REAL_API=1 e REAL_ADMIN_TOKEN de uma sessão confirmada por e-mail.');
  const token = process.env.REAL_ADMIN_TOKEN;
  const response = await request.get('http://localhost:3333/api/agendamentos', { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBeTruthy();
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('psicologa_token', token);
    localStorage.setItem('psicologa_usuario', JSON.stringify(user));
  }, { token, user: { ...claims, nome: 'Profissional de teste' } });
  await page.goto('http://localhost:5173/adm/agenda');

  await expect(page).toHaveURL(/\/adm\/agenda$/);
  await expect(page.getByRole('heading', { name: /^Olá,/ })).toBeVisible();
  await expect(page.locator('.agenda-feedback.error')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('psicologa_token')))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('agenda-real.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('agenda-mobile-real.png'), fullPage: true });
});
