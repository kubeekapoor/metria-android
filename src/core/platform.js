/* Plataforma: cosas que en escritorio hacía Electron (versión, guardar archivo,
 * avisos de actividad externa para no bloquear mientras se elige/comparte un archivo).
 */

import { isNative } from './fs.js';

export const APP_VERSION = '1.1.0';

let externalUntil = 0;
let deps = {};

/* boot.js inyecta los plugins ya importados (App, Share, Filesystem...)
 * porque en Capacitor los proxies se registran al importarlos. */
export function configurePlatform(next) {
  deps = { ...deps, ...next };
}

/* En Android, el puente nativo se inyecta antes de los scripts de la app.
 * Esperamos un poco por si el WebView aún no lo expuso. */
export async function waitForCapacitor(timeoutMs = 3000) {
  if (!globalThis.Capacitor) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform() && deps.Filesystem) return true;
    if (!globalThis.Capacitor.isNativePlatform || !globalThis.Capacitor.isNativePlatform()) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

export async function version() {
  const App = deps.App;
  if (App && typeof App.getInfo === 'function') {
    try {
      const info = await App.getInfo();
      if (info && info.version) return info.version;
    } catch { /* usa la constante */ }
  }
  return APP_VERSION;
}

/* Marca una ventana en la que la app queda en segundo plano por una acción del
 * usuario (selector de archivos o hoja de compartir). El bloqueo por sistema
 * se pospone para no interrumpir la operación. */
export function beginExternalActivity(ms = 5 * 60 * 1000) {
  externalUntil = Date.now() + ms;
}

export function endExternalActivity() {
  externalUntil = 0;
}

export const isExternalActivity = () => Date.now() < externalUntil;

function downloadInBrowser(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Guarda el respaldo cifrado. En Android lo escribe en la caché privada y abre
 * la hoja de compartir para que el usuario elija Archivos, Drive, correo, etc. */
export async function saveFile(text, filename) {
  beginExternalActivity();
  if (!isNative()) {
    downloadInBrowser(text, filename);
    return { ok: true };
  }
  const { Filesystem, Share, Directory, Encoding } = deps;
  if (!Filesystem || !Share) throw new Error('Plugins de archivos no disponibles.');
  await Filesystem.writeFile({
    path: filename,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  try {
    await Share.share({
      title: filename,
      files: [uri],
      dialogTitle: 'Guardar respaldo de Metría',
    });
  } catch (e) {
    /* El usuario canceló la hoja de compartir: no es un error de la app. */
    if (!/cancel/i.test(String(e && e.message))) throw e;
  }
  return { ok: true };
}

export const platform = {
  isNative,
  version,
  saveFile,
  beginExternalActivity,
  endExternalActivity,
  isExternalActivity,
  waitForCapacitor,
  configurePlatform,
};

/* app.html comprueba window.MetriaPlatform antes de usar el guardado nativo. */
if (typeof window !== 'undefined') window.MetriaPlatform = platform;
