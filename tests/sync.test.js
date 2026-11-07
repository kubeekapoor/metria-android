/* Sincronización de versión, etiqueta e iconos.
 * Evita que el APK salga con un versionCode, un nombre o un icono de otra tanda.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

test('versión sincronizada en package, Android, web y documentación', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const gradle = read('android/app/build.gradle');
  const platform = read('src/core/platform.js');
  const authUi = read('src/core/auth-ui.js');
  const build = read('scripts/build.sh');
  const readme = read('README.md');
  const guide = read('docs/COMPILAR-APK.md');

  assert.equal(pkg.version, '1.2.2');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.match(gradle, /versionCode\s+5\b/);
  assert.match(gradle, /versionName\s+"1\.2\.2"/);
  assert.match(platform, /APP_VERSION\s*=\s*'1\.2\.2'/);
  assert.match(authUi, /'1\.2\.2'/);
  assert.match(build, /dist\/metria-1\.2\.2-android\.apk/);
  assert.match(readme, /\*\*Versión:\*\*\s*1\.2\.2/);
  assert.match(readme, /dist\/metria-1\.2\.2-android\.apk/);
  assert.match(guide, /versionCode 5\b/);
  assert.match(guide, /versionName "1\.2\.2"/);
  assert.match(guide, /dist\/metria-1\.2\.2-android\.apk/);
});

test('etiqueta visible: Metria sin acento (D-18)', () => {
  const strings = read('android/app/src/main/res/values/strings.xml');
  const capacitor = JSON.parse(read('capacitor.config.json'));
  const pkg = JSON.parse(read('package.json'));

  assert.match(strings, /<string name="app_name">Metria<\/string>/);
  assert.match(strings, /<string name="title_activity_main">Metria<\/string>/);
  assert.equal(capacitor.appName, 'Metria');
  assert.equal(pkg.productName, 'Metria');
  assert.ok(!strings.includes('Metría'), 'strings.xml no debe conservar el acento');
});

test('iconos oficiales presentes y sin vectores de plantilla', () => {
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  for (const density of densities) {
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_monochrome']) {
      const path = `android/app/src/main/res/mipmap-${density}/${name}.png`;
      assert.ok(existsSync(join(ROOT, path)), `Falta ${path}`);
    }
  }

  for (const version of ['v26', 'v33']) {
    assert.ok(existsSync(join(ROOT, `android/app/src/main/res/mipmap-anydpi-${version}/ic_launcher.xml`)));
    assert.ok(existsSync(join(ROOT, `android/app/src/main/res/mipmap-anydpi-${version}/ic_launcher_round.xml`)));
  }

  const v33 = read('android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml');
  assert.match(v33, /monochrome\s+android:drawable="@mipmap\/ic_launcher_monochrome"/);

  assert.ok(existsSync(join(ROOT, 'android/app/src/main/res/drawable-nodpi/splash_logo.png')));
  assert.ok(!existsSync(join(ROOT, 'android/app/src/main/res/drawable/ic_launcher_background.xml')),
    'El vector de plantilla del fondo debe estar eliminado');
  assert.ok(!existsSync(join(ROOT, 'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml')),
    'El vector de plantilla del primer plano debe estar eliminado');
});
