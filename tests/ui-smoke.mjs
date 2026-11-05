/* Prueba de humo de la interfaz real en Chromium (Brave).
 *
 * Simula el almacenamiento con localStorage y comprueba:
 * crear cuenta -> frase de recuperación -> interfaz financiera -> recarga ->
 * contraseña incorrecta -> contraseña correcta.
 *
 * No sustituye la prueba en un teléfono Android: valida la lógica y el DOM.
 */

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'www'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});

function fail(message) {
  console.error('✖', message);
  process.exitCode = 1;
}

try {
  await sleep(700);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/brave-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Crea tu contraseña', { timeout: 15000 });
  await page.screenshot({ path: '/tmp/metria-01-crear.png' });

  await page.fill('#password', 'clave-de-prueba');
  await page.fill('#confirm', 'clave-de-prueba');
  await page.click('button[type=submit]');

  await page.waitForSelector('[data-phrase]', { timeout: 40000 });
  const phrase = (await page.textContent('[data-phrase]')).trim();
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){9}$/.test(phrase)) fail('La frase de recuperación no tiene el formato esperado: ' + phrase);
  await page.screenshot({ path: '/tmp/metria-02-frase.png' });

  await page.check('#confirmed');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Balance actual', { timeout: 30000 });
  await page.waitForSelector('nav', { timeout: 5000 });
  await page.screenshot({ path: '/tmp/metria-03-inicio.png' });
  console.log('✔ Cuenta creada y la interfaz financiera cargó');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Ingresa tu contraseña', { timeout: 15000 });

  await page.fill('#password', 'incorrecta');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Contraseña incorrecta.', { timeout: 15000 });
  console.log('✔ Contraseña incorrecta rechazada');

  await page.fill('#password', 'clave-de-prueba');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Balance actual', { timeout: 30000 });
  console.log('✔ Contraseña correcta y datos conservados');

  /* Recuperación: no cambia la contraseña hasta definir una nueva. */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Ingresa tu contraseña', { timeout: 15000 });
  await page.click('[data-forgot]');
  await page.fill('#recoveryKey', phrase);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Define una contraseña nueva', { timeout: 40000 });
  await page.fill('#password', 'clave-nueva-1');
  await page.fill('#confirm', 'clave-nueva-1');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Balance actual', { timeout: 30000 });
  console.log('✔ Recuperación con frase y contraseña nueva');

  await page.screenshot({ path: '/tmp/metria-04-final.png' });

  if (errors.length) {
    fail('Errores de consola:\n' + errors.join('\n'));
  } else {
    console.log('✔ Sin errores de consola');
  }

  await browser.close();
} catch (e) {
  fail(e.stack || String(e));
} finally {
  server.kill('SIGTERM');
}
