/* Bóveda: formato del archivo cifrado, escritura atómica y respaldos.
 *
 * El archivo es idéntico al de la versión de escritorio:
 * {
 *   format: 1,
 *   passwordSalt, recoverySalt,          // 32 hex (16 bytes)
 *   wrappedByPassword, wrappedByRecovery,// AES-GCM de la llave maestra
 *   data                                 // AES-GCM de todo el almacén
 * }
 * Por eso un data-store.json del escritorio se puede abrir aquí, y viceversa.
 */

import * as crypto from './crypto.js';
import { fileStore } from './fs.js';

export const DATA_FILE = 'data-store.json';
export const TMP_FILE = 'data-store.json.tmp';
export const BACKUPS_DIR = 'backups';
export const MAX_BACKUPS = 15;
export const MAX_PRE_IMPORT = 5;

export class VaultError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const hex = (s, len) => typeof s === 'string' && /^[0-9a-f]+$/i.test(s) && (!len || s.length === len) && s.length % 2 === 0;
const enc = (o) => o && hex(o.iv, 24) && hex(o.authTag, 32) && hex(o.ciphertext);
const salt = (s) => hex(s, 32);

export async function hasAccount() {
  return fileStore().exists(DATA_FILE);
}

export async function readRaw() {
  return fileStore().readText(DATA_FILE);
}

/* Valida la envoltura sin descifrar. Lanza CORRUPT si el archivo no tiene el formato. */
export function parseWrapperFile(text) {
  let w;
  try { w = JSON.parse(text); } catch { throw new VaultError('CORRUPT'); }
  if (!w || w.format !== crypto.FORMAT_VERSION || !salt(w.passwordSalt) || !salt(w.recoverySalt)
      || !enc(w.wrappedByPassword) || !enc(w.wrappedByRecovery) || !enc(w.data)) {
    throw new VaultError('CORRUPT');
  }
  return w;
}

export async function writeAtomic(text) {
  const fs = fileStore();
  await fs.writeText(TMP_FILE, text);
  try {
    await fs.rename(TMP_FILE, DATA_FILE);
    return;
  } catch {
    /* Algunos sistemas no reemplazan al renombrar. Guardamos el archivo actual
       en memoria para poder restaurarlo si el segundo intento también falla. */
    let previous = null;
    try {
      if (await fs.exists(DATA_FILE)) previous = await fs.readText(DATA_FILE);
    } catch {
      previous = null;
    }
    try {
      await fs.remove(DATA_FILE);
      await fs.rename(TMP_FILE, DATA_FILE);
    } catch (error) {
      if (previous !== null) {
        try { await fs.writeText(DATA_FILE, previous); } catch { /* último recurso */ }
      }
      throw error;
    }
  }
}

export async function writeStore(store, masterKey, wrappers) {
  const data = await crypto.encryptJson(store, masterKey);
  const file = {
    format: crypto.FORMAT_VERSION,
    passwordSalt: wrappers.passwordSalt,
    recoverySalt: wrappers.recoverySalt,
    wrappedByPassword: wrappers.wrappedByPassword,
    wrappedByRecovery: wrappers.wrappedByRecovery,
    data,
  };
  await writeAtomic(JSON.stringify(file));
}

/* Genera llave maestra + frase de recuperación SIN escribir nada a disco. */
export async function prepareNewStore(password) {
  const masterKey = crypto.randomBytes(32);
  const passwordSalt = crypto.randomHex(16);
  const recoverySalt = crypto.randomHex(16);
  const recoveryKey = crypto.generateRecoveryKey();
  const wrappedByPassword = await crypto.encryptBytes(masterKey, await crypto.deriveKey(password, passwordSalt));
  const wrappedByRecovery = await crypto.encryptBytes(
    masterKey,
    await crypto.deriveKey(crypto.normalizeRecoveryInput(recoveryKey), recoverySalt),
  );
  return {
    masterKey,
    recoveryKey,
    wrappers: { passwordSalt, recoverySalt, wrappedByPassword, wrappedByRecovery },
  };
}

const wrappersOf = (w) => ({
  passwordSalt: w.passwordSalt,
  recoverySalt: w.recoverySalt,
  wrappedByPassword: w.wrappedByPassword,
  wrappedByRecovery: w.wrappedByRecovery,
});

async function decryptStore(w, masterKey) {
  let store;
  try {
    store = await crypto.decryptJson(w.data, masterKey);
  } catch {
    throw new VaultError('CORRUPT');
  }
  if (!store || typeof store !== 'object' || Array.isArray(store)) throw new VaultError('CORRUPT');
  return store;
}

/* kind: 'password' | 'recovery'. Distingue secreto incorrecto de archivo dañado. */
export async function unlockWithSecret(kind, secret) {
  const raw = await readRaw();
  const w = parseWrapperFile(raw);
  const isPassword = kind === 'password';
  const saltHex = isPassword ? w.passwordSalt : w.recoverySalt;
  const wrapped = isPassword ? w.wrappedByPassword : w.wrappedByRecovery;

  let masterKey;
  try {
    masterKey = await crypto.decryptBytes(wrapped, await crypto.deriveKey(secret, saltHex));
  } catch {
    throw new VaultError(isPassword ? 'WRONG_PASSWORD' : 'WRONG_RECOVERY');
  }

  const store = await decryptStore(w, masterKey);
  return { masterKey, store, wrappers: wrappersOf(w) };
}

/* Desbloqueo con una llave maestra ya descifrada (biometría).
 * La llave viene del Keystore y solo es válida para este archivo. Se copia para
 * que el llamador pueda borrar el búfer original sin destruir la sesión. */
export async function unlockWithMasterKey(masterKey) {
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== 32) {
    throw new VaultError('BAD_KEY');
  }
  const sessionKey = new Uint8Array(masterKey);
  try {
    const raw = await readRaw();
    const w = parseWrapperFile(raw);
    const store = await decryptStore(w, sessionKey);
    return { masterKey: sessionKey, store, wrappers: wrappersOf(w) };
  } catch (e) {
    sessionKey.fill(0);
    throw e;
  }
}

export async function rewrapPassword(masterKey, newPassword) {
  const passwordSalt = crypto.randomHex(16);
  return {
    passwordSalt,
    wrappedByPassword: await crypto.encryptBytes(masterKey, await crypto.deriveKey(newPassword, passwordSalt)),
  };
}

let backupSeq = 0;
const stamp = () => `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(++backupSeq).padStart(4, '0')}`;

/* Copia de arranque: últimos 15, y solo si el archivo cambió. */
export async function makeStartupBackup() {
  const fs = fileStore();
  if (!(await fs.exists(DATA_FILE))) return;
  let raw;
  try {
    raw = await fs.readText(DATA_FILE);
    JSON.parse(raw); // si está truncado, no se respalda para no desplazar copias buenas
  } catch {
    return;
  }
  await fs.mkdir(BACKUPS_DIR);
  const files = (await fs.list(BACKUPS_DIR)).filter(f => f.startsWith('data-store-') && f.endsWith('.json')).sort();
  const last = files[files.length - 1];
  if (last) {
    try {
      if ((await fs.readText(`${BACKUPS_DIR}/${last}`)) === raw) return;
    } catch { /* si la última copia no se puede leer, se crea otra */ }
  }
  const name = `data-store-${stamp()}.json`;
  await fs.writeText(`${BACKUPS_DIR}/${name}`, raw);
  files.push(name);
  while (files.length > MAX_BACKUPS) {
    await fs.remove(`${BACKUPS_DIR}/${files.shift()}`);
  }
}

/* Copia previa a importar (cifrada con la llave de la app): últimas 5. */
export async function snapshot() {
  const fs = fileStore();
  try {
    if (!(await fs.exists(DATA_FILE))) return { ok: true };
    await fs.mkdir(BACKUPS_DIR);
    const raw = await fs.readText(DATA_FILE);
    const name = `pre-import-${stamp()}.json`;
    await fs.writeText(`${BACKUPS_DIR}/${name}`, raw);
    const files = (await fs.list(BACKUPS_DIR)).filter(f => f.startsWith('pre-import-') && f.endsWith('.json')).sort();
    while (files.length > MAX_PRE_IMPORT) await fs.remove(`${BACKUPS_DIR}/${files.shift()}`);
    return { ok: true };
  } catch (e) {
    console.error('No se pudo crear la copia de seguridad:', e);
    return { ok: false, error: 'No se pudo crear la copia de seguridad.' };
  }
}

export function authErrorMessage(e) {
  if (e instanceof VaultError) {
    if (e.code === 'WRONG_PASSWORD') return 'Contraseña incorrecta.';
    if (e.code === 'WRONG_RECOVERY') return 'Frase de recuperación incorrecta.';
    if (e.code === 'BAD_KEY') return 'La llave de desbloqueo no es válida. Ingresa tu contraseña.';
    if (e.code === 'CORRUPT') return 'El archivo de datos está dañado o es ilegible. No se modificó nada: restaura un respaldo automático.';
  }
  console.error(e);
  return 'No se pudo completar la operación.';
}
