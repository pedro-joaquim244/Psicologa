import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

// Serve real files only, with GitHub Pages' 404.html fallback (not Vite's rewrite).
const root = resolve('dist');
const base = '/Psicologa/';
const fallback = await readFile(resolve(root, '404.html'));
assert.match(fallback.toString(), /\/Psicologa\/assets\//, 'Execute npm run build:pages primeiro.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
  const path = resolve(root, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
  if (!path.startsWith(`${root}${sep}`)) { res.writeHead(403); res.end(); return; }
  try {
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(fallback);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}${base}`);
  await page.locator('#inicio').getByRole('link', { name: 'Agendar uma conversa', exact: true }).click();
  assert.equal(new URL(page.url()).hash, '#agendamento');
  await page.locator('#booking-title').waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('link', { name: 'Área profissional' }).getAttribute('href'), '/Psicologa/adm/login');
  await page.getByRole('link', { name: 'Área profissional' }).click();
  await page.getByRole('heading', { name: /Bem-vinda/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/Psicologa/adm/login');
  const direct = await page.reload();
  assert.equal(direct.status(), 404);
  await page.getByRole('heading', { name: /Bem-vinda/ }).waitFor();
  const photo = await page.request.get(`${origin}${base}images/consultorio.jpg`);
  assert.equal(photo.status(), 200);
  await page.goto(`${origin}${base}adm/agenda`);
  await page.waitForURL('**/Psicologa/adm/login');
  await page.evaluate(() => {
    localStorage.setItem('psicologa_token', 'test-pages');
    localStorage.setItem('psicologa_usuario', JSON.stringify({ nome: 'Helena', tipo: 'psicologa' }));
  });
  await page.route('**/api/agendamentos', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto(`${origin}${base}adm/agenda`);
  await page.getByRole('heading', { name: 'Ainda não há atendimentos.' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/Psicologa/adm/agenda');
  await page.goto(`${origin}${base}minhas-consultas`);
  await page.waitForURL('**/Psicologa/login');
  await page.evaluate(() => {
    localStorage.setItem('paciente_token', 'patient-pages');
    localStorage.setItem('paciente_usuario', JSON.stringify({ nome: 'Joaquim Sousa', tipo: 'paciente', email: 'joaquim@example.com' }));
  });
  await page.route('**/api/usuario/agendamentos', (route) => route.fulfill({ json: [] }));
  const patientDirect = await page.goto(`${origin}${base}minhas-consultas`);
  assert.equal(patientDirect.status(), 404);
  await page.getByText('Você ainda não possui consultas agendadas.').waitFor();
  await page.reload();
  await page.getByText('Você ainda não possui consultas agendadas.').waitFor();
  assert.equal(await page.locator('.patient-intro').getByRole('link', { name: 'Agendar uma conversa' }).getAttribute('href'), '/Psicologa/#agendamento');
  await page.locator('.patient-intro').getByRole('link', { name: 'Agendar uma conversa' }).click();
  await page.locator('#booking-title').waitFor();
  assert.equal(new URL(page.url()).pathname, '/Psicologa/');
  assert.equal(new URL(page.url()).hash, '#agendamento');
  assert.deepEqual(errors, []);
  console.log('Pages aprovado: landing, âncora, assets, rodapé, rotas diretas com 404.html, agenda e consultas protegidas.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
