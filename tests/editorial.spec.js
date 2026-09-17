import { test, expect } from '@playwright/test';

test('sistema editorial e novas seções mantêm leitura em todas as telas', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('body')).toHaveCSS('font-family', /Manrope/);
  await expect(page.locator('h1')).toHaveCSS('font-family', /Cormorant Garamond/);
  await expect(page.locator('.credentials-list > div')).toHaveCount(4);
  await expect(page.locator('.journey-moment')).toHaveCount(5);
  await expect(page.locator('.circular-badge')).toHaveCount(2);
  await expect(page.locator('.botanical')).toHaveCount(2);
  await page.locator('.reflection-section').scrollIntoViewIfNeeded();
  await expect(page.locator('#reflection-title')).toBeVisible();
  await expect.poll(() => page.locator('.reflection-section').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(204, 220, 224)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.story-enabled')).toHaveCount(0);
  for (const section of ['#sobre', '#percurso', '.reflection-section', '#contato']) {
    await page.locator(section).scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  const portrait = await page.locator('.portrait-frame').boundingBox();
  const detail = await page.locator('.about-detail').boundingBox();
  if (testInfo.project.name === 'mobile') expect(detail.y).toBeGreaterThan(portrait.y + portrait.height);
  else expect(detail.y).toBeLessThan(portrait.y + portrait.height);
  const ids = await page.locator('svg defs path').evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('cada atendimento mantém sua foto bem enquadrada e seus links acessíveis', async ({ page }) => {
  await page.goto('/#atendimento');
  const online = page.getByRole('link', { name: 'Saiba mais sobre psicoterapia online pelo WhatsApp' });
  await online.focus();
  await expect(page.locator('.services-preview img').nth(1)).toHaveClass('is-active');
  await expect(page.locator('.service-row').nth(1)).toHaveClass(/is-active/);
  await expect(online).toHaveAttribute('href', /wa.me.*online/);
  await page.getByRole('link', { name: 'Saiba mais sobre psicoterapia presencial pelo WhatsApp' }).focus();
  await expect(page.locator('.services-preview img').nth(0)).toHaveClass('is-active');
  for (const frame of await page.locator('.services-preview').all()) {
    await frame.scrollIntoViewIfNeeded();
    const visibleFraction = await frame.evaluate(element => {
      const photo = element.querySelector('img');
      const sourceRatio = Number(photo.getAttribute('width')) / Number(photo.getAttribute('height'));
      const frameRatio = element.clientWidth / element.clientHeight;
      return Math.min(sourceRatio, frameRatio) / Math.max(sourceRatio, frameRatio);
    });
    expect(visibleFraction, 'O enquadramento deve preservar a maior parte da fotografia').toBeGreaterThan(.75);
    await expect(frame.locator('img')).toHaveCSS('opacity', '1');
  }
});

test('texto horizontal e percurso SVG respondem ao scroll', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'reduced-motion', 'Movimentos removidos por preferência do usuário.');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const offset = () => page.locator('.marquee-track').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  const start = await offset();
  await page.locator('.editorial-marquee').evaluate((element) => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
  await expect.poll(async () => Math.abs(await offset() - start)).toBeGreaterThan(50);
  const path = page.locator(testInfo.project.name === 'mobile' ? '.journey-mobile-line .journey-drawing' : '.journey-desktop-line .journey-drawing');
  const before = Number.parseFloat(await path.evaluate((element) => getComputedStyle(element).strokeDashoffset));
  expect(before).toBeGreaterThan(100);
  await page.locator('#percurso').evaluate((element) => window.scrollTo({ top: scrollY + element.getBoundingClientRect().bottom - innerHeight * .5, behavior: 'instant' }));
  await expect.poll(async () => Number.parseFloat(await path.evaluate((element) => getComputedStyle(element).strokeDashoffset))).toBeLessThan(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
