import { expect, test } from '@playwright/test';

const config = { demoMode: false, emailDelivery: true, publicRegistration: true, demoAccess: { paciente: false, profissional: false } };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/config', route => route.fulfill({ json: config }));
});

test('centraliza topo e âncoras sem saltos duplicados', async ({ page }) => {
  await page.goto('/#faq');
  const headerHeight = await page.locator('.site-header').evaluate(element => element.offsetHeight);
  await expect.poll(() => page.locator('#faq').evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(headerHeight - 2);

  await page.getByRole('link', { name: 'Sobre', exact: true }).first().click();
  await expect(page).toHaveURL(/#sobre$/);
  await expect.poll(() => page.locator('#sobre').evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(headerHeight - 2);

  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  if (page.viewportSize().width < 1200) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('calendário e formulário preservam a posição da página', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-09-10T12:00:00'));
  await page.addInitScript(() => {
    localStorage.setItem('paciente_token', 'scroll-patient-token');
    localStorage.setItem('paciente_usuario', JSON.stringify({ id: 7, nome: 'Paciente Teste', telefone: '11999999999', email: 'paciente@example.com', tipo: 'paciente' }));
  });
  await page.route('**/api/horarios?*', route => route.fulfill({ json: { horarios: [{ horario: '09:00', fim: '09:50' }] } }));

  await page.goto('/#agendamento');
  await page.locator('[data-date="2030-09-18"]').click();
  const availableSlot = page.getByRole('button', { name: '09:00 até 09:50' });
  await expect(availableSlot).toBeVisible();
  await availableSlot.scrollIntoViewIfNeeded();
  const beforeSlot = await page.evaluate(() => window.scrollY);
  await availableSlot.click();
  await expect(page.getByLabel('Nome completo')).toBeVisible();
  await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), beforeSlot)).toBeLessThanOrEqual(2);

  const beforeInput = await page.evaluate(() => window.scrollY);
  const presencial = page.getByRole('radio', { name: 'Presencial', exact: true }).first();
  await presencial.scrollIntoViewIfNeeded();
  const visibleBeforeInput = await page.evaluate(() => window.scrollY);
  await presencial.check();
  await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), visibleBeforeInput)).toBeLessThanOrEqual(2);
});

test('modal devolve o foco sem alterar a posição anterior', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('psicologa_token', 'scroll-admin-token');
    localStorage.setItem('psicologa_usuario', JSON.stringify({ id: 1, nome: 'Mauricéia Soares', email: 'profissional@example.com', tipo: 'psicologa' }));
  });
  const appointments = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    nome_cliente: `Paciente ${index + 1}`,
    inicio: `2030-09-${String(18 + index).padStart(2, '0')} 15:00:00`,
    fim: `2030-09-${String(18 + index).padStart(2, '0')} 15:50:00`,
    modalidade: 'online',
    status: 'agendado',
  }));
  await page.route('**/api/agendamentos', route => route.fulfill({ json: appointments }));

  await page.goto('/adm/agenda');
  const cancel = page.getByRole('article').last().getByRole('button', { name: 'Cancelar', exact: true });
  await cancel.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await cancel.click();
  const modal = page.getByRole('alertdialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(cancel).toBeFocused();
  await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), before)).toBeLessThanOrEqual(2);
});
