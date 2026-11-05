/* Arranque de Metría en Android.
 *
 * 1. Espera el puente de Capacitor y elige el almacenamiento.
 * 2. Hace el respaldo de arranque (cifrado, sin necesitar la contraseña).
 * 3. Muestra acceso / creación de cuenta.
 * 4. Solo después de desbloquear carga app.css y app.js (la interfaz financiera)
 *    y arranca el bloqueo automático.
 *
 * Al bloquear se recarga la página: la llave y los datos descifrados desaparecen
 * de la memoria, igual que cuando Electron destruye la ventana principal.
 */

import * as auth from './auth.js';
import * as vault from './vault.js';
import { installBridges } from './bridges.js';
import { AuthUI } from './auth-ui.js';
import { startAutoLock, stopAutoLock, ping } from './lock.js';
import { platform, configurePlatform } from './platform.js';
import { setFileStore, capacitorStore, localStorageStore } from './fs.js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const authRoot = document.getElementById('auth');
const appRoot = document.getElementById('app');

let ui = null;
let entering = false;

function lockReason() {
  try {
    const reason = sessionStorage.getItem('metria.lockReason') || '';
    sessionStorage.removeItem('metria.lockReason');
    return reason;
  } catch {
    return '';
  }
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('No se pudo cargar ' + href));
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.MetriaApp) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.body.appendChild(script);
  });
}

async function enterApp() {
  if (entering) return;
  entering = true;
  try {
    await loadStylesheet('app.css');
    await loadStylesheet('mobile.css');
    await loadScript('app.js');
    if (!window.MetriaApp) throw new Error('La interfaz no se cargó.');
    authRoot.hidden = true;
    appRoot.hidden = false;
    await window.MetriaApp.init();
    startAutoLock({
      getMinutes: () => auth.getAutoLockMinutes(),
      onLock: lock,
      app: App,
    });
  } catch (e) {
    console.error(e);
    entering = false;
    authRoot.hidden = false;
    appRoot.hidden = true;
    if (ui) ui.showError('No se pudo cargar la aplicación. Cierra Metría y vuelve a abrirla.');
    return;
  }
  entering = false;
}

function lock(reason) {
  stopAutoLock();
  try { if (window.MetriaApp) window.MetriaApp.shutdown(); } catch { /* ya no está */ }
  try { sessionStorage.setItem('metria.lockReason', reason || ''); } catch { /* sin sessionStorage */ }
  window.location.reload();
}

async function boot() {
  configurePlatform({ App, Share, Filesystem, Directory, Encoding });
  await platform.waitForCapacitor();
  if (Capacitor.isNativePlatform()) {
    setFileStore(capacitorStore({ Filesystem, Directory, Encoding }));
  } else {
    setFileStore(localStorageStore());
  }

  installBridges({ onActivity: ping });

  /* La pantalla de acceso siempre es oscura: íconos claros en la barra de estado. */
  if (window.systemBars) window.systemBars.setTheme('dark');

  /* Gesto/botón Atrás de Android: cierra capas, vuelve de página o minimiza.
     Sin este listener, Capacitor no hace nada cuando la web no tiene historial. */
  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', () => {
      let handled = false;
      try {
        handled = !!(window.MetriaApp && typeof window.MetriaApp.handleBack === 'function'
          && window.MetriaApp.handleBack());
      } catch (e) {
        console.error(e);
      }
      if (!handled) {
        try { App.minimizeApp(); } catch { /* sin plugin nativo */ }
      }
    }).catch(() => {});
  }

  let has = false;
  try {
    has = await auth.hasAccount();
    await vault.makeStartupBackup();
  } catch (e) {
    console.error(e);
  }

  /* El estado biométrico se consulta con la sesión bloqueada: solo indica si
     hay una inscripción válida y si el teléfono puede autenticar. */
  let biometric = { supported: false, available: false, enabled: false };
  if (has) {
    try { biometric = await auth.biometricStatus(); } catch (e) { console.error(e); }
  }

  ui = new AuthUI(authRoot, {
    version: await platform.version(),
    onUnlock: (password) => auth.unlock(password),
    onCreate: (password, confirm) => auth.create(password, confirm),
    onRecover: (key) => auth.recover(key),
    onSetNewPassword: (password, confirm) => auth.setNewPassword(password, confirm),
    onConfirmRecovery: () => auth.confirmRecoverySaved(),
    onBiometricUnlock: () => auth.unlockWithBiometric(),
    onEnterApp: enterApp,
  });

  if (has) ui.showUnlock(lockReason(), biometric);
  else ui.showCreate();
}

boot().catch(e => {
  console.error(e);
  document.getElementById('auth').innerHTML =
    '<div class="auth-wrap"><div class="auth-card"><div class="auth-brand">Metría</div>'
    + '<h1>No se pudo iniciar</h1><p class="sub">Cierra Metría y vuelve a abrirla.</p></div></div>';
});
