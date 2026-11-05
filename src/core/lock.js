/* Bloqueo automático (F17) y bloqueo al pasar a segundo plano.
 *
 * En escritorio Electron emite suspend/lock-screen. En Android el equivalente
 * es que la app deje de estar activa (pantalla apagada, otra app, inicio).
 * Se exceptúan las acciones que abren el selector de archivos o la hoja de
 * compartir, porque también mandan la app a segundo plano.
 */

import { platform } from './platform.js';

let timer = null;
let active = false;
let opts = null;
let appHandle = null;
let firing = false;

const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule() {
  clearTimer();
  if (!active || !opts) return;
  const minutes = Number(opts.getMinutes());
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  timer = setTimeout(() => fire('idle'), minutes * 60 * 1000);
}

function fire(reason) {
  if (!active || firing) return;
  firing = true;
  active = false;
  clearTimer();
  try {
    opts.onLock(reason);
  } finally {
    firing = false;
  }
}

function onActivity() {
  if (active) schedule();
}

function onVisibility() {
  if (!active) return;
  if (document.visibilityState === 'hidden') {
    if (!platform.isExternalActivity()) fire('system');
  } else {
    platform.endExternalActivity();
    schedule();
  }
}

function onAppState({ isActive }) {
  if (!active) return;
  if (!isActive) {
    if (!platform.isExternalActivity()) fire('system');
  } else {
    platform.endExternalActivity();
    schedule();
  }
}

export function startAutoLock(options) {
  stopAutoLock();
  opts = options;
  active = true;
  for (const ev of activityEvents) document.addEventListener(ev, onActivity, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  const App = options.app;
  if (App && typeof App.addListener === 'function') {
    Promise.resolve(App.addListener('appStateChange', onAppState))
      .then(h => { appHandle = h; })
      .catch(() => { /* sin plugin: queda visibilitychange */ });
  }
  schedule();
}

export function stopAutoLock() {
  active = false;
  clearTimer();
  if (appHandle && typeof appHandle.remove === 'function') {
    Promise.resolve(appHandle.remove()).catch(() => {});
    appHandle = null;
  }
  for (const ev of activityEvents) document.removeEventListener(ev, onActivity);
  document.removeEventListener('visibilitychange', onVisibility);
}

/* app.html llama a window.security.ping() con la actividad del usuario. */
export const ping = onActivity;
