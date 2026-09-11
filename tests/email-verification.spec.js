import { test, expect } from '@playwright/test';

test('só abre a sessão após o código; permite corrigir e reenviar', async ({ page }, testInfo) => {
  await page.clock.install();
  let generation = 0;
  const challenge = () => ({ verificacaoPendente: true, desafio: String(generation).repeat(64), email: 'paciente@example.com', expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 });
  await page.route('**/api/pacientes/login', route => route.fulfill({ json: challenge() }));
  await page.route('**/api/pacientes/reenviar-codigo', route => { generation++; return route.fulfill({ json: challenge() }); });
  await page.route('**/api/pacientes/verificar-email', route => {
    const body = route.request().postDataJSON();
    expect(body.desafio).toBe(String(generation).repeat(64));
    return route.fulfill(body.codigo === '012345'
      ? { json: { token: 'verified-token', usuario: { id: 1, nome: 'Paciente', tipo: 'paciente', email: 'paciente@example.com', email_verificado: true } } }
      : { status: 400, json: { erro: 'Código incorreto. Confira o e-mail e tente novamente.' } });
  });
  await page.route('**/api/horarios?*', route => route.fulfill({ json: { horarios: [] } }));
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('paciente@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Senha123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail.' })).toBeVisible();
  await expect(page.getByLabel('Código de verificação')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
  await expect(page.getByRole('button', { name: /Reenviar código/ })).toBeDisabled();
  await page.getByLabel('Código de verificação').fill('111111');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Código incorreto');
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Reenviar código', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Novo código enviado');
  await expect(page.getByLabel('Código de verificação')).toHaveValue('');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('verificacao-email.png'), fullPage: true });
  await page.getByLabel('Código de verificação').fill('012345');
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/#agendamento$/);
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBe('verified-token');
});

test('expiração, falha de reenvio e volta ao login não criam sessão', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/pacientes/login', route => route.fulfill({ json: { verificacaoPendente: true, desafio: 'a'.repeat(64), email: 'paciente@example.com', expiraEm: Date.now() + 600000, reenviarEm: Date.now() + 60000 } }));
  await page.route('**/api/pacientes/reenviar-codigo', route => route.fulfill({ status: 503, json: { erro: 'Não foi possível enviar o código.' } }));
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('paciente@example.com');
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
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('psicologa_token'))).toBeNull();
});
