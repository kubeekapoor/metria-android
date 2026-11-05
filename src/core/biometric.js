/* Desbloqueo biométrico (solo Android).
 *
 * El plugin nativo cifra la llave maestra con una llave del Android Keystore
 * que exige huella o rostro. Este módulo solo transporta la llave cifrada y
 * la llave maestra ya descifrada; nunca guarda la contraseña.
 *
 * En navegador (pruebas y desarrollo) todas las operaciones devuelven
 * "no disponible" sin lanzar errores, para que el resto del núcleo funcione
 * igual que en escritorio.
 */

/* Se guarda el proxy dentro de un objeto: devolver el proxy directamente desde
 * una promesa haría que Capacitor intente tratarlo como "thenable" y falle. */
let pluginPromise = null;

function nativeAvailable() {
  const cap = globalThis.Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

function plugin() {
  if (!nativeAvailable()) return Promise.resolve(null);
  if (!pluginPromise) {
    pluginPromise = import('@capacitor/core')
      .then(({ registerPlugin }) => ({ instance: registerPlugin('MetriaBiometric') }))
      .catch(() => null);
  }
  return pluginPromise;
}

export async function status() {
  const holder = await plugin();
  if (!holder) return { supported: false, available: false, enabled: false, requiresPassword: false, reason: 'WEB' };
  const p = holder.instance;
  try {
    const r = await p.status();
    return {
      supported: true,
      available: !!r.available,
      enabled: !!r.enabled,
      requiresPassword: !!r.requiresPassword,
      reason: r.reason || '',
    };
  } catch (e) {
    console.error(e);
    return { supported: false, available: false, enabled: false, requiresPassword: false, reason: 'ERROR' };
  }
}

export async function enroll(masterKey) {
  const holder = await plugin();
  if (!holder) return { ok: false, error: 'El desbloqueo biométrico solo está disponible en Android.' };
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    return { ok: false, error: 'La llave maestra no es válida.' };
  }
  const p = holder.instance;
  try {
    const r = await p.enroll({ key: toBase64(masterKey) });
    if (r && r.ok) return { ok: true };
    return { ok: false, error: (r && r.error) || 'No se pudo activar el desbloqueo biométrico.', code: r && r.code };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo activar el desbloqueo biométrico.' };
  }
}

export async function unlock() {
  const holder = await plugin();
  if (!holder) return { ok: false, error: 'El desbloqueo biométrico solo está disponible en Android.' };
  const p = holder.instance;
  try {
    const r = await p.unlock();
    if (r && r.ok && typeof r.key === 'string') return { ok: true, key: r.key };
    return { ok: false, error: (r && r.error) || 'No se pudo desbloquear con biometría.', code: r && r.code };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo desbloquear con biometría.' };
  }
}

export async function disable() {
  const holder = await plugin();
  if (!holder) return { ok: true };
  const p = holder.instance;
  try {
    const r = await p.disable();
    return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || 'No se pudo desactivar.' };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo desactivar el desbloqueo biométrico.' };
  }
}

/* Avisa al plugin que el usuario entró con contraseña o frase de recuperación.
 * Así se habilita la biometría de nuevo tras un reinicio del teléfono. */
export async function noteUnlock() {
  const holder = await plugin();
  if (!holder) return;
  const p = holder.instance;
  if (typeof p.noteUnlock !== 'function') return;
  try { await p.noteUnlock(); } catch { /* no es crítico */ }
}

export function fromBase64(value) {
  const raw = atob(String(value || ''));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toBase64(bytes) {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw);
}
