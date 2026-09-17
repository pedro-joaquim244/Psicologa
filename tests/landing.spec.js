import { test, expect } from '@playwright/test';

test('conteúdo, imagens, FAQ, contatos e ausência de overflow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('h1')).toHaveText('Um espaço parase escutar commais calma.');
  await expect(page.locator('main > section, main > .pin-spacer > section')).toHaveCount(14);
  await page.screenshot({ path: testInfo.outputPath('hero.png') });

  for (const section of await page.locator('main > section, main > .pin-spacer > section').all()) {
    await section.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
  await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  const photoSources = await page.locator('main img').evaluateAll((photos) => photos.map(photo => photo.src));
  expect(new Set(photoSources).size, 'Cada fotografia deve ter um lugar próprio na página').toBe(photoSources.length);
  for (const photo of await page.locator('main img').all()) {
    await expect(photo).toHaveAttribute('srcset', /\.webp \d+w/);
    await expect(photo).toHaveAttribute('sizes', /vw/);
  }

  const onlineQuestion = page.getByRole('button', { name: /O atendimento pode ser online/ });
  await onlineQuestion.click();
  await expect(onlineQuestion).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#faq-answer-2')).toBeVisible();
  await expect(page.locator('#faq-answer-0')).toBeHidden();
  await onlineQuestion.click();
  await expect(page.locator('#faq-answer-2')).toBeHidden();
  await onlineQuestion.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#faq-answer-2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Agendar pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa.me\/5500000000000\?text=/);
  await expect(page.getByRole('link', { name: /Saiba mais sobre psicoterapia presencial/ })).toHaveAttribute('href', /presencial/);
  await expect(page.getByRole('link', { name: /Saiba mais sobre psicoterapia online/ })).toHaveAttribute('href', /online/);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('âncoras e menu acessível', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
    await page.getByRole('button', { name: 'Abrir menu' }).click();
  }
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre', exact: true }).click();
  await expect(page).toHaveURL(/#sobre$/);
  await expect.poll(() => page.locator('#sobre').evaluate((element) => Math.abs(element.getBoundingClientRect().top - (window.innerWidth < 576 ? 90 : 104)))).toBeLessThan(4);
  if (mobile) await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.site-header')).toHaveClass(/is-scrolled/);
  await page.goto('/#faq');
  await expect(page.getByRole('button', { name: /Como funciona a primeira sessão/ })).toBeInViewport();
});

test('scroll adapta pin, expansão e etapas à preferência de movimento', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  if (testInfo.project.name !== 'desktop') {
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await page.locator('#abordagem').scrollIntoViewIfNeeded();
    for (const heading of ['Escuta', 'Compreensão', 'Construção']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    return;
  }
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  const initial = await page.locator('.hero-photo').boundingBox();
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
  await expect.poll(async () => (await page.locator('.hero-photo').boundingBox()).width).toBeGreaterThan(initial.width * 1.7);
  await expect.poll(async () => Math.abs((await page.locator('.hero').boundingBox()).y)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('hero-expanded.png') });

  for (let index = 0; index < 3; index++) {
    await page.locator('.approach-step').nth(index).evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - window.innerHeight * .35, behavior: 'instant' }));
    await expect(page.locator('.approach-current')).toHaveText(`0${index + 1}`);
    await expect(page.locator('.approach-step').nth(index)).toHaveClass(/is-active/);
    await expect(page.locator('.approach-image').nth(index)).toHaveClass(/is-active/);
    await expect(page.locator('.approach-indicator').nth(index)).toHaveAttribute('aria-current', 'step');
  }

  const firstStep = page.getByRole('button', { name: 'Ver etapa 01: Escuta' });
  await firstStep.focus();
  await page.keyboard.press('Enter');
  await expect(firstStep).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.approach-current')).toHaveText('01');
  await page.getByRole('button', { name: 'Ver etapa 03: Construção' }).click();
  await expect(page.locator('.approach-current')).toHaveText('03');
  await expect(page.locator('.approach-image-label')).toHaveText('POSSIBILIDADES QUE FAZEM SENTIDO PARA VOCÊ.');

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
  await expect.poll(() => page.locator('.hero-photo').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).isIdentity)).toBe(true);
});

test('layout permanece dentro da tela em celular pequeno, tablet e notebook', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Matriz de tamanhos executada uma vez.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [[320, 740], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const overflow = await page.locator('h1, h2, h3, .hero-actions, .service-row, .faq-item').evaluateAll((elements) => elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
    }).map((element) => element.textContent));
    expect(overflow, `Conteúdo não pode ser cortado em ${width}px`).toEqual([]);
    if (width === 768 || width === 1366) await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`) });
  }
});
