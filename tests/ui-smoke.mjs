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

  /* ---------- interacción: cada control debe responder a UN toque ---------- */
  if (await page.locator('#toast').count() !== 1) fail('Falta el contenedor de avisos #toast');

  const themeBefore = await page.getAttribute('body', 'data-theme');
  await page.tap('#theme-toggle');
  await page.waitForFunction((t) => document.body.getAttribute('data-theme') !== t, themeBefore, { timeout: 5000 });
  console.log('✔ El tema cambia con un toque');

  await page.tap('.tabbar [data-page="ajustes"]');
  await page.waitForSelector('#autolock-select', { timeout: 5000 });

  await page.tap('[data-scale="1.15"]');
  await page.waitForFunction(() => document.querySelector('[data-scale="1.15"]').classList.contains('active'), null, { timeout: 5000 });
  const zoom = await page.evaluate(() => document.documentElement.style.zoom);
  if (zoom !== '1.15') fail('La escala no se aplicó con un toque: ' + zoom);
  await page.tap('[data-scale="1"]');
  console.log('✔ La escala cambia con un toque');

  await page.selectOption('#autolock-select', '15');
  await page.waitForFunction(() => document.getElementById('autolock-select').value === '15', null, { timeout: 5000 });
  let toast = (await page.textContent('#toast')) || '';
  if (!toast.includes('Bloqueo automático actualizado')) fail('El cambio de bloqueo no mostró aviso: ' + toast);
  await page.selectOption('#autolock-select', '0');
  await page.waitForFunction(() => document.getElementById('autolock-select').value === '0', null, { timeout: 5000 });
  console.log('✔ El bloqueo automático cambia con un solo cambio de opción');

  await page.tap('#export-btn');
  await page.waitForSelector('#pw-main', { timeout: 5000 });
  await page.tap('[data-pw-cancel]');
  await page.waitForSelector('#pw-main', { state: 'detached', timeout: 5000 });
  console.log('✔ El modal de respaldo abre y cierra con un toque');

  /* Alta de cuenta: elegir color después de escribir no debe borrar el texto. */
  await page.tap('.tabbar [data-page="home"]');
  await page.waitForSelector('#fab', { timeout: 5000 });
  await page.tap('#fab');
  await page.waitForSelector('[data-act="cuenta"]', { timeout: 5000 });
  await page.tap('[data-act="cuenta"]');
  await page.waitForSelector('#pm-form', { timeout: 5000 });

  /* Los círculos de color deben medir lo mismo de ancho y de alto: si una regla
     global de auth.css les impone min-height, se ven como óvalos. */
  const swatches = await page.evaluate(() => [...document.querySelectorAll('.pm-swatch')].map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }));
  if (!swatches.length) fail('No se encontraron los círculos de color');
  const oval = swatches.find((s) => s.w !== s.h || s.w < 24);
  if (oval) fail('Círculo de color distorsionado: ' + JSON.stringify(oval));
  console.log(`✔ Los ${swatches.length} círculos de color son circulares (${swatches[0].w}×${swatches[0].h})`);

  await page.fill('#pm-form input[name="name"]', 'Efectivo');
  await page.fill('#pm-form input[name="capital"]', '1000');
  await page.tap('[data-pmcolor-fn="selectNewPmColor"][data-pmcolor="#18B47A"]');
  await page.waitForFunction(() => document.querySelector('#pm-form input[name="name"]').value === 'Efectivo', null, { timeout: 5000 });
  await page.tap('#pm-form button[type="submit"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.entry-detail')].some((e) => e.textContent.includes('Efectivo')), null, { timeout: 5000 });
  toast = (await page.textContent('#toast')) || '';
  if (!toast.includes('Cuenta disponible agregada')) fail('La cuenta no se agregó con un toque: ' + toast);
  console.log('✔ La cuenta se agrega con un toque y conserva lo escrito');

  await page.tap('.back');
  await page.waitForSelector('.tabbar [data-page="categorias"]', { timeout: 5000 });

  /* Alta de categoría desde Categorías → Mis categorías. */
  await page.tap('.tabbar [data-page="categorias"]');
  await page.waitForSelector('[data-page="catadmin"]', { timeout: 5000 });
  await page.tap('[data-page="catadmin"]');
  await page.waitForSelector('#cat-form', { timeout: 5000 });
  await page.fill('#cat-form input[name="name"]', 'Prueba');
  await page.tap('#cat-form button[type="submit"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.entry-detail')].some((e) => e.textContent.trim() === 'Prueba'), null, { timeout: 5000 });
  console.log('✔ La categoría se agrega con un toque');

  /* Quitar la categoría: el modal de confirmación actúa con un toque. */
  await page.locator('.entry-row', { hasText: 'Prueba' }).locator('[data-delcat]').tap();
  await page.waitForSelector('[data-confirm-ok]', { timeout: 5000 });
  await page.tap('[data-confirm-ok]');
  await page.waitForFunction(() => ![...document.querySelectorAll('.entry-detail')].some((e) => e.textContent.trim() === 'Prueba'), null, { timeout: 5000 });
  console.log('✔ La confirmación elimina con un toque');

  await page.tap('.back');
  await page.waitForSelector('.tabbar [data-page="home"]', { timeout: 5000 });

  /* Captura de un ingreso con un solo envío. */
  await page.tap('.tabbar [data-page="home"]');
  await page.waitForSelector('#fab', { timeout: 5000 });
  await page.tap('#fab');
  await page.waitForSelector('[data-act="ingreso"]', { timeout: 5000 });
  await page.tap('[data-act="ingreso"]');
  await page.waitForSelector('#entry-form', { timeout: 5000 });
  await page.fill('#entry-form input[name="monto"]', '250.50');
  await page.selectOption('#entry-form select[name="paymentMethod"]', { label: 'Efectivo' });
  await page.tap('#entry-form button[type="submit"]');
  await page.waitForFunction(() => (document.getElementById('toast')?.textContent || '').includes('Movimiento guardado'), null, { timeout: 5000 });
  await page.waitForFunction(() => document.body.textContent.includes('250.50'), null, { timeout: 5000 });
  console.log('✔ El movimiento se guarda y aparece con un toque');

  await page.tap('.back');
  await page.waitForSelector('.tabbar [data-page="resumen"]', { timeout: 5000 });

  /* Reportes: tipo, granularidad y navegación de periodo. */
  await page.tap('.tabbar [data-page="resumen"]');
  await page.waitForSelector('[data-rtype="gasto"]', { timeout: 5000 });
  await page.tap('[data-rtype="gasto"]');
  await page.waitForFunction(() => document.querySelector('[data-rtype="gasto"]').classList.contains('active'), null, { timeout: 5000 });
  await page.tap('[data-gran="semana"]');
  await page.waitForFunction(() => document.querySelector('[data-gran="semana"]').classList.contains('active'), null, { timeout: 5000 });
  const periodBefore = (await page.textContent('.period-label')).trim();
  await page.tap('[data-nav="-1"]');
  await page.waitForFunction((p) => document.querySelector('.period-label').textContent.trim() !== p, periodBefore, { timeout: 5000 });
  console.log('✔ Reportes responde a un toque');

  /* En navegador la biometría debe explicar que solo existe en Android. */
  await page.tap('.tabbar [data-page="ajustes"]');
  await page.waitForSelector('text=solo está disponible en la app de Android', { timeout: 5000 });
  console.log('✔ Ajustes explica la biometría en navegador');

  /* La franja del notch debe ser opaca, fija y cubrir todo el área segura. */
  const notch = await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    const cs = getComputedStyle(document.body, '::before');
    return { height: cs.height, position: cs.position, z: Number(cs.zIndex), background: cs.backgroundColor };
  });
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-inset-top'));
  if (notch.height !== '44px' || notch.position !== 'fixed' || notch.z < 100) {
    fail('La franja del notch no cubre el área segura: ' + JSON.stringify(notch));
  }
  if (notch.background === 'rgba(0, 0, 0, 0)' || notch.background === 'transparent') {
    fail('La franja del notch es transparente: ' + notch.background);
  }
  console.log('✔ La franja del notch es fija y opaca');

  /* Atrás: cierra la hoja, vuelve de una subpágina y no se come el Inicio. */
  await page.tap('.tabbar [data-page="home"]');
  await page.waitForSelector('#fab', { timeout: 5000 });
  await page.tap('#fab');
  await page.waitForSelector('.sheet-title', { timeout: 5000 });
  if (!(await page.evaluate(() => window.MetriaApp.handleBack()))) fail('Atrás no cerró la hoja');
  await page.waitForSelector('.sheet-title', { state: 'detached', timeout: 5000 });
  if ((await page.evaluate(() => window.MetriaApp.handleBack())) !== false) {
    fail('Atrás debe devolver false en Inicio para minimizar la app');
  }
  await page.tap('.tabbar [data-page="resumen"]');
  await page.waitForSelector('[data-rtype="gasto"]', { timeout: 5000 });
  if (!(await page.evaluate(() => window.MetriaApp.handleBack()))) fail('Atrás no volvió desde Reportes');
  await page.waitForSelector('.fl-card', { timeout: 5000 });
  console.log('✔ El gesto Atrás cierra capas, vuelve de página y respeta Inicio');

  /* Deslizar horizontalmente entre las pestañas principales. */
  const swipe = (fromX, toX) => page.evaluate(([x1, x2]) => {
    const target = document.body;
    const base = { identifier: 1, target, clientY: 400, pageY: 400, screenY: 400, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 };
    const start = new Touch({ ...base, clientX: x1, pageX: x1, screenX: x1 });
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
    const end = new Touch({ ...base, clientX: x2, pageX: x2, screenX: x2 });
    target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [end] }));
  }, [fromX, toX]);
  await swipe(320, 80);
  await page.waitForSelector('[data-rtype="gasto"]', { timeout: 5000 });
  await swipe(80, 320);
  await page.waitForSelector('.fl-card', { timeout: 5000 });
  console.log('✔ Deslizar cambia de pestaña y vuelve');

  if (!(await page.evaluate(() => !!window.systemBars))) fail('Falta el puente de las barras del sistema');
  const bars = await page.evaluate(() => window.systemBars.setTheme('dark'));
  if (bars !== false && bars !== true) fail('El tema de las barras no respondió en navegador: ' + bars);
  console.log('✔ El tema de las barras del sistema no falla en navegador');

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
