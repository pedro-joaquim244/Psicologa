import { test, expect } from '@playwright/test';

test('escolha do formato prepara a mensagem e funciona pelo teclado', async ({ page }, testInfo) => {
  await page.goto('/#contato');
  const group = page.getByRole('group', { name: 'Qual formato faz sentido para você?' });
  await expect(group.getByRole('radio', { name: 'Quero conversar' })).toBeChecked();
  await group.getByText('Online', { exact: true }).click();
  await expect(group.getByRole('radio', { name: 'Online', exact: true })).toBeChecked();
  const contactLink = page.getByRole('link', { name: 'Agendar pelo WhatsApp', exact: true });
  let message = new URL(await contactLink.getAttribute('href')).searchParams.get('text');
  expect(message).toContain('atendimento online');
  await expect(page.locator('#format-description')).toContainText('videochamada');
  await group.getByRole('radio', { name: 'Online', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'Presencial', exact: true })).toBeChecked();
  message = new URL(await contactLink.getAttribute('href')).searchParams.get('text');
  expect(message).toContain('atendimento presencial');
  await expect(page.locator('#format-description')).toContainText('Ribeirão Preto');
  await page.locator('#contato').screenshot({ path: testInfo.outputPath('contact.png') });
});

test('FAQ permite navegação por setas e mantém contato acessível após expandir', async ({ page }) => {
  await page.goto('/#faq');
  const first = page.locator('#faq-question-0');
  await first.focus();
  await page.keyboard.press('End');
  await expect(page.locator('#faq-question-4')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#faq-question-1')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#faq-answer-1')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.getByRole('link', { name: 'Agendar pelo WhatsApp', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('.contact-options')).toHaveCSS('opacity', '1');
});

test('navegação acompanha saltos entre seções e ignora âncoras inválidas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#%E0%A4%A');
  await page.evaluate(() => document.fonts.ready);
  for (const id of ['atendimento', 'faq', 'sobre', 'contato', 'inicio']) {
    await page.locator(`#${id}`).evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 100, behavior: 'instant' }));
    await expect(page.locator(`#main-navigation a[href="#${id === 'contato' ? 'agendamento' : id}"]`)).toHaveAttribute('aria-current', 'location');
    await expect(page.locator('#main-navigation [aria-current]')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('agendamento móvel é contextual e menu cabe na tela em paisagem', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Interação específica do celular.');
  await page.goto('/');
  const bar = page.getByRole('complementary', { name: 'Agendamento rápido', includeHidden: true });
  await expect(bar).toBeHidden();
  await page.locator('#sobre').evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
  await expect(bar).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(bar).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(bar).toBeVisible();
  await bar.getByRole('link').click();
  await expect(page).toHaveURL(/#agendamento$/);
  await expect(bar).toBeHidden();
  await page.setViewportSize({ width: 740, height: 360 });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect.poll(() => menu.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(361);
  const schedule = menu.getByRole('link', { name: 'Agendar consulta' });
  await schedule.scrollIntoViewIfNeeded();
  await expect(schedule).toBeInViewport();
  await schedule.click();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
});
