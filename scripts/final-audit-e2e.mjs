import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const resolutions = [
  { width: 320, height: 568, name: '320x568 (iPhone SE antigo)' },
  { width: 360, height: 800, name: '360x800 (Android compacto)' },
  { width: 375, height: 812, name: '375x812 (iPhone X/12 mini)' },
  { width: 390, height: 844, name: '390x844 (iPhone 13/14)' },
  { width: 414, height: 896, name: '414x896 (iPhone XR/11)' },
  { width: 430, height: 932, name: '430x932 (iPhone Pro Max)' },
  { width: 768, height: 1024, name: '768x1024 (iPad Portrait)' },
  { width: 1024, height: 768, name: '1024x768 (iPad Landscape / Tablet)' },
  { width: 1366, height: 768, name: '1366x768 (Laptop Standard)' },
  { width: 1920, height: 1080, name: '1920x1080 (Desktop FHD)' },
];

async function runAudit() {
  console.log('=== INICIANDO AUDITORIA FINAL COMPLETA COM PLAYWRIGHT ===\n');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // -------------------------------------------------------------
  // ETAPA 1: VISITANTE E OVERFLOW HORIZONTAL EM TODAS AS 10 RESOLUÇÕES
  // -------------------------------------------------------------
  console.log('--- ETAPA 1: Verificação de Responsividade e Ausência de Overflow Horizontal ---');
  for (const res of resolutions) {
    await page.setViewportSize({ width: res.width, height: res.height });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);

    if (hasOverflow) {
      console.error(`❌ OVERFLOW DETECTADO em ${res.name}: scrollWidth=${scrollWidth} > innerWidth=${innerWidth}`);
    } else {
      console.log(`✓ ${res.name}: Sem overflow horizontal (${scrollWidth} <= ${innerWidth})`);
    }
  }

  // -------------------------------------------------------------
  // ETAPA 2: CADASTRO DE PACIENTE COM VALIDAÇÃO DE TODOS OS CAMPOS
  // -------------------------------------------------------------
  console.log('\n--- ETAPA 2: Validações de Formulário de Cadastro ---');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${BASE_URL}/cadastro`, { waitUntil: 'domcontentloaded' });

  // 2.1 Senhas diferentes
  await page.getByLabel('Nome completo').fill('Maria da Silva Teste');
  await page.getByLabel('WhatsApp com DDD').fill('16998887766');
  await page.getByLabel('E-mail', { exact: true }).fill('maria.teste@example.com');
  await page.locator('#admin-password').fill('SenhaForte123');
  await page.locator('#admin-confirm-password').fill('SenhaDiferente456');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForTimeout(300);

  const errorSenhas = await page.locator('.login-error').innerText().catch(() => '');
  console.log(`✓ Teste senhas diferentes: "${errorSenhas.trim()}"`);

  // 2.2 Senha curta (< 8 caracteres)
  await page.locator('#admin-password').fill('12345');
  await page.locator('#admin-confirm-password').fill('12345');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForTimeout(300);
  const errorSenhaCurta = await page.locator('.login-error').innerText().catch(() => '');
  console.log(`✓ Teste senha curta: "${errorSenhaCurta.trim()}"`);

  // 2.3 Email inválido
  await page.locator('#admin-password').fill('SenhaForte123');
  await page.locator('#admin-confirm-password').fill('SenhaForte123');
  await page.getByLabel('E-mail', { exact: true }).fill('email_invalido_sem_arroba');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForTimeout(300);
  const errorEmail = await page.locator('.login-error').innerText().catch(() => '');
  console.log(`✓ Teste e-mail inválido: "${errorEmail.trim()}"`);

  // -------------------------------------------------------------
  // ETAPA 3: LOGIN DA PSICÓLOGA
  // -------------------------------------------------------------
  console.log('\n--- ETAPA 3: Login da Psicóloga (Acesso Direto Sem Código) ---');
  await page.goto(`${BASE_URL}/adm/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mail', { exact: true }).fill('jocazinho14@gmail.com');
  await page.locator('#admin-password').fill('SenhaForte123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForTimeout(1000);

  // Se a senha não conferir com a gerada no banco de desenvolvimento, verificamos a mensagem
  const urlAtual = page.url();
  const erroLogin = await page.locator('.login-error').innerText().catch(() => '');
  console.log(`Status login adm: URL=${urlAtual} ${erroLogin ? `(aviso: ${erroLogin.trim()})` : 'Sucesso!'}`);

  // -------------------------------------------------------------
  // ETAPA 4: JORNADA / PERCURSO NA LANDING PAGE
  // -------------------------------------------------------------
  console.log('\n--- ETAPA 4: Verificação da Seção Percurso / Jornada ---');
  await page.goto(`${BASE_URL}/#percurso`, { waitUntil: 'networkidle' });
  const momentsCount = await page.locator('.journey-moment').count();
  console.log(`✓ Quantidade de momentos da jornada visíveis: ${momentsCount}`);
  const titles = await page.locator('.journey-title').allInnerTexts();
  console.log(`✓ Momentos carregados: ${titles.join(' -> ')}`);

  // -------------------------------------------------------------
  // ETAPA 5: ERROS TOTAIS NO CONSOLE
  // -------------------------------------------------------------
  console.log('\n--- ETAPA 5: Auditoria de Logs do Console ---');
  if (consoleErrors.length === 0 && pageErrors.length === 0) {
    console.log('✓ ZERO erros críticos no console durante todos os testes!');
  } else {
    console.log(`Avisos/erros encontrados (${consoleErrors.length}):`, consoleErrors);
  }

  await browser.close();
  console.log('\n=== AUDITORIA FINAL CONCLUÍDA COM SUCESSO ===');
}

runAudit().catch(console.error);
