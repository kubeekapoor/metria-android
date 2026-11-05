/* Bloqueo automático (F17) y bloqueo al pasar a segundo plano.
 *
 * El ajuste de inactividad (1/5/15/30 min) manda también cuando la app pasa a
 * segundo plano: no se bloquea al instante, sino cuando se cumple ese tiempo.
 * Con 0 ("Nunca") no se bloquea sola ni al salir.
 *
 * Al volver del segundo plano se comprueba el tiempo transcurrido porque los
 * navegadores móviles pueden pausar los temporizadores mientras la app está
 * oculta. Las acciones que abren el selector de archivos o la hoja de compartir
 * se tratan aparte: el tiempo que dure esa acción no cuenta como inactividad.
 */

import { platform } from './platform.js';

let timer = null;
let active = false;
let opts = null;
let appHandle = null;
let firing = false;
let lastActivity = Date.now();
let externalPaused = false;

const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function minutes() {
  const value = Number(opts && opts.getMinutes());
  return Number.isFinite(value) ? value : 0;
}

function schedule() {
  clearTimer();
  if (!active || !opts) return;
  const limit = minutes();
  if (limit <= 0) return;
  const remaining = limit * 60 * 1000 - (Date.now() - lastActivity);
  if (remaining <= 0) {
    fire('idle');
    return;
  }
  timer = setTimeout(() => fire('idle'), remaining);
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
  lastActivity = Date.now();
  if (active) schedule();
}

/* Mientras el usuario elige un archivo o comparte un respaldo, la app está en
 * segundo plano pero no inactiva: se detiene el temporizador y se reinicia al
 * volver. */
function pauseForExternal() {
  externalPaused = true;
  clearTimer();
}

function resume() {
  platform.endExternalActivity();
  if (!active) return;
  if (externalPaused) {
    externalPaused = false;
    lastActivity = Date.now();
    schedule();
    return;
  }
  const limit = minutes();
  if (limit > 0 && Date.now() - lastActivity >= limit * 60 * 1000) {
    fire('system');
    return;
  }
  schedule();
}

function onVisibility() {
  if (!active) return;
  if (document.visibilityState === 'hidden') {
    if (platform.isExternalActivity()) pauseForExternal();
  } else {
    resume();
  }
}

function onAppState({ isActive }) {
  if (!active) return;
  if (!isActive) {
    if (platform.isExternalActivity()) pauseForExternal();
  } else {
    resume();
  }
}

export function startAutoLock(options) {
  stopAutoLock();
  opts = options;
  active = true;
  lastActivity = Date.now();
  externalPaused = false;
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
