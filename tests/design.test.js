/* Guardas de la Tanda C: evitan que vuelvan los patrones que rompen el
 * sistema de diseño (transparencias decorativas, literales y texto diminuto).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const css = ['www/app.css', 'www/auth.css', 'www/mobile.css'].map(read).join('\n');
const app = read('www/app.js');
const tokens = read('metria-design-system/design-tokens.css');

test('sin transparencias decorativas ni desenfoque', () => {
  for (const source of [css, app]) {
    assert.ok(!source.includes('color-mix('), 'color-mix() volvió al CSS/JS');
    assert.ok(!source.includes('backdrop-filter'), 'backdrop-filter volvió al CSS/JS');
    assert.ok(!source.includes('rgba('), 'rgba() decorativo volvió al CSS/JS');
  }
});

test('sin colores literales en los componentes', () => {
  assert.ok(!css.match(/#[0-9a-fA-F]{3,8}/), 'Hay un color hex literal en app.css/auth.css/mobile.css');
  assert.ok(!app.match(/#[0-9a-fA-F]{6}/), 'Hay un color hex literal en app.js');
  assert.ok(!css.includes('#636366') && !app.includes('#636366'), '#636366 volvió');
  assert.ok(!css.includes('#fff') && !app.includes('#fff'), '#fff volvió');
});

test('ningún texto funcional por debajo de 12 px', () => {
  const small = [...css.matchAll(/font-size\s*:\s*([0-9.]+)px/g)]
    .map((match) => Number(match[1]))
    .filter((size) => size < 12);
  assert.deepEqual(small, [], 'Hay font-size < 12px en el CSS de componentes');
});

test('la paleta de cuentas y la tinta vienen de tokens', () => {
  assert.match(tokens, /--account-color-1:\s*#4C6FFF/);
  assert.match(tokens, /--account-color-10:\s*#64748B/);
  assert.match(tokens, /--color-text-on-light-color:\s*#000000/);
  assert.match(tokens, /--color-text-on-dark-color:\s*#FFFFFF/);
  assert.match(app, /--account-color-1/);
  assert.match(app, /function pmInk\s*\(/);
  assert.match(app, /--color-text-on-light-color/);
  assert.match(app, /--color-text-on-dark-color/);
  assert.ok(!/const PM_COLORS\s*=\s*\[/.test(app), 'PM_COLORS no debe ser una lista de hex literales');
});

test('los botones secundarios no dependen de un color embebido', () => {
  assert.match(read('www/app.css'), /\.btn-save\.btn-secondary/);
  assert.ok(!app.includes('--chip-color:#'), 'Queda un color embebido en un botón');
});

test('los iconos de cuenta eligen tinta por contraste', () => {
  assert.match(read('www/app.css'), /\.pm-badge\{[^}]*font-family:var\(--mono\)/);
  assert.ok(!/\.pm-badge\{[^}]*color\s*:/.test(read('www/app.css')),
    '.pm-badge no debe fijar un color de glifo');
  assert.match(app, /class="pm-badge" style="background:\$\{m\.color\};color:\$\{pmInk\(m\.color\)\}"/);
});
