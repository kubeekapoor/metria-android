/* Puentes que app.html ya conoce (los mismos que preload.js exponía en Electron).
 * Si una operación no está permitida (sesión bloqueada, clave inválida), se lanza
 * un error igual que en escritorio; la interfaz lo muestra sin tocar los datos.
 */

import * as auth from './auth.js';
import * as vault from './vault.js';
import * as crypto from './crypto.js';
import { platform } from './platform.js';

const DENIED = { ok: false, error: 'Operación no permitida.' };
const BACKUP_FORMAT = 'metria-backup';
const BACKUP_MAX_CHARS = 20 * 1024 * 1024;

const isHex = (s, len) => typeof s === 'string' && /^[0-9a-f]+$/i.test(s)
  && (!len || s.length === len) && s.length % 2 === 0;

export function installBridges({ onActivity } = {}) {
  window.storage = {
    get: (key) => auth.storageGet(key),
    set: (key, value) => auth.storageSet(key, value),
    delete: (key) => auth.storageDelete(key),
  };

  window.backup = {
    async encrypt(payload, password) {
      if (!auth.isUnlocked()) return DENIED;
      if (typeof payload !== 'string' || !payload || payload.length > BACKUP_MAX_CHARS) {
        return { ok: false, error: 'No hay datos válidos para respaldar.' };
      }
      if (typeof password !== 'string' || password.length < crypto.MIN_PASSWORD_LENGTH) {
        return { ok: false, error: `La contraseña del respaldo debe tener al menos ${crypto.MIN_PASSWORD_LENGTH} caracteres.` };
      }
      try {
        const salt = crypto.randomHex(16);
        const enc = await crypto.encryptText(payload, await crypto.deriveKey(password, salt));
        const file = JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          kdf: { name: 'scrypt', ...crypto.KDF },
          salt,
          ...enc,
        }, null, 2);
        return { ok: true, file };
      } catch (e) {
        console.error(e);
        return { ok: false, error: 'No se pudo cifrar el respaldo.' };
      }
    },

    async decrypt(text, password) {
      if (!auth.isUnlocked()) return DENIED;
      if (typeof text !== 'string' || text.length > BACKUP_MAX_CHARS || typeof password !== 'string' || !password) {
        return { ok: false, error: 'Ingresa la contraseña del respaldo.' };
      }
      let f;
      try { f = JSON.parse(text); } catch {
        return { ok: false, error: 'El archivo no es un respaldo válido.' };
      }
      const kdfOk = f && f.kdf && f.kdf.name === 'scrypt'
        && f.kdf.N === crypto.KDF.N && f.kdf.r === crypto.KDF.r && f.kdf.p === crypto.KDF.p;
      if (!f || f.format !== BACKUP_FORMAT || f.version !== 1 || !kdfOk
          || !isHex(f.salt, 32) || !isHex(f.iv, 24) || !isHex(f.authTag, 32) || !isHex(f.ciphertext)) {
        return { ok: false, error: 'El archivo no es un respaldo válido o es de una versión no compatible.' };
      }
      try {
        const payload = await crypto.decryptText(f, await crypto.deriveKey(password, f.salt));
        return { ok: true, payload };
      } catch {
        return { ok: false, error: 'Contraseña del respaldo incorrecta, o el archivo fue alterado.' };
      }
    },

    async snapshot() {
      if (!auth.isUnlocked()) return DENIED;
      return vault.snapshot();
    },
  };

  window.security = {
    ping: () => { if (typeof onActivity === 'function') onActivity(); },
    /* app.html usa .then() sobre getAutoLock: debe ser una promesa, como el IPC de Electron. */
    getAutoLock: () => Promise.resolve(
      auth.isUnlocked()
        ? { ok: true, minutes: auth.getAutoLockMinutes(), options: auth.AUTOLOCK_OPTIONS }
        : DENIED,
    ),
    setAutoLock: async (minutes) => {
      if (!auth.isUnlocked()) return DENIED;
      return auth.setAutoLock(minutes);
    },
  };

  window.appInfo = {
    version: () => platform.version(),
  };
}
