import { test, expect } from '@playwright/test';

const titles = ['Ansiedade', 'Autoconhecimento', 'Relacionamentos', 'Mudanças de vida', 'Autoestima', 'Sobrecarga emocional', 'Dificuldades profissionais', 'Processos de decisão'];

async function openSection(page) {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator('.audience-section');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('button', { name: 'Ansiedade', exact: true })).toBeVisible();
  return section;
}

test('todos os temas abrem e fecham, mantendo só uma descrição aberta', async ({ page }, testInfo) => {
  const section = await openSection(page);
  await expect(section.locator('[aria-expanded="true"]')).toHaveCount(0);
  await expect(section.locator('#audience-title em')).toHaveText('você.');
  await expect(section.locator('.audience-footnote')).toHaveText('Cada pessoa tem uma história. O cuidado começa ao reconhecer a sua.');
  for (const title of titles) {
    const button = section.getByRole('button', { name: title, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(section.locator('[aria-expanded="true"]')).toHaveCount(1);
    const answer = section.getByRole('region', { name: title, exact: true });
    await expect(answer).toBeVisible();
    await expect(answer.locator('p')).not.toBeEmpty();
    expect(await button.getAttribute('aria-controls')).toBe(await answer.getAttribute('id'));
    await expect.poll(() => answer.evaluate(el => el.style.height)).toBe('auto');
    await expect(answer.locator('p')).toHaveCSS('opacity', '1');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(section.locator('.audience-panel[aria-hidden="false"]')).toHaveCount(0);
  }
  await section.getByRole('button', { name: 'Relacionamentos', exact: true }).click();
  await section.getByRole('button', { name: 'Ansiedade', exact: true }).click();
  await expect(section.getByRole('region')).toHaveCount(1);
  await expect(section.getByRole('region', { name: 'Ansiedade', exact: true })).toBeVisible();
  await expect.poll(() => section.locator('.audience-panel[aria-hidden="false"]').evaluate(el => el.style.height)).toBe('auto');
  await expect.poll(() => section.locator('[data-reveal]').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1'))).toBe(true);
  await section.screenshot({ path: testInfo.outputPath('para-quem-aberto.png'), style: '.site-header, .mobile-contact { visibility: hidden !important; }' });
});

test('teclado, foco e hover mantêm a interação acessível e discreta', async ({ page }, testInfo) => {
  const section = await openSection(page);
  const first = section.getByRole('button', { name: 'Ansiedade', exact: true });
  await first.focus();
  await expect(first).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowDown');
  await expect(section.getByRole('button', { name: 'Autoconhecimento', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(section.getByRole('button', { name: 'Processos de decisão', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(section.getByRole('button', { name: 'Processos de decisão', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  if (testInfo.project.name !== 'mobile') {
    const background = await first.evaluate(el => getComputedStyle(el).backgroundColor);
    await first.hover();
    await expect(first).toHaveCSS('color', 'rgb(89, 110, 91)');
    await expect(first).toHaveCSS('background-color', background);
    await expect(section.locator('.audience-item').first()).toHaveCSS('border-bottom-color', 'rgb(89, 110, 91)');
    await first.click();
    await expect(section.locator('.audience-close').first()).toHaveCSS('opacity', '1');
    await expect(section.locator('.audience-arrow').first()).toHaveCSS('opacity', '0');
  }
});

test('CTA usa o agendamento existente, inclusive após expandir a lista', async ({ page }) => {
  const section = await openSection(page);
  await section.getByRole('button', { name: 'Ansiedade', exact: true }).click();
  await expect.poll(() => section.locator('.audience-panel').first().evaluate(el => el.style.height)).toBe('auto');
  const cta = section.getByRole('link', { name: 'Agendar uma conversa', exact: true });
  await expect(cta).toHaveAttribute('href', '#agendamento');
  await cta.click();
  await expect(page).toHaveURL(/#agendamento$/);
  await expect(page.locator('#agendamento')).toHaveCount(1);
  await expect(page.locator('#booking-title')).toBeInViewport();
});

test('abertura adapta altura, cliques rápidos e preferência de movimento', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz responsiva executada uma vez.');
  const section = await openSection(page);
  await section.getByRole('button', { name: 'Ansiedade', exact: true }).evaluate(button => { button.click(); button.click(); button.click(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[320,740], [768,1024], [1024,768], [1440,900]]) {
    await page.setViewportSize({ width, height });
    await section.scrollIntoViewIfNeeded();
    const answer = section.getByRole('region', { name: 'Ansiedade', exact: true });
    await expect(answer).toBeVisible();
    await expect(answer.locator('p')).toHaveCSS('opacity', '1');
    await expect.poll(() => answer.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    for (const button of await section.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  }
  await section.getByRole('button', { name: 'Ansiedade', exact: true }).click();
  await expect(section.locator('.audience-panel').first()).toHaveCSS('height', '0px');
  await expect(section.locator('.audience-panel').first()).toBeHidden();
});
