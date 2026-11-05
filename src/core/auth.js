/* Máquina de estados de autenticación.
 *
 *   locked -> pendingRecoveryConfirm -> unlocked   (cuenta nueva)
 *   locked -> pendingNewPassword     -> unlocked   (recuperación)
 *   locked -> unlocked                              (contraseña correcta)
 *
 * La llave maestra y los datos descifrados viven SOLO en memoria. Al bloquear
 * se borra la llave; el archivo de disco siempre queda cifrado.
 */

import * as vault from './vault.js';
import * as crypto from './crypto.js';

export const AUTOLOCK_OPTIONS = [0, 1, 5, 15, 30];
export const AUTOLOCK_DEFAULT = 5;
const STORAGE_KEY_RE = /^[A-Za-z][A-Za-z0-9_:-]{0,99}$/;

let state = 'locked';
let masterKey = null;
let storeCache = null;
let wrappers = null;
let pending = null;

function validateNewPassword(password, confirmPassword) {
  if (typeof password !== 'string' || password.length < crypto.MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${crypto.MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
  return null;
}

function adopt(unlocked) {
  masterKey = unlocked.masterKey;
  storeCache = unlocked.store;
  wrappers = unlocked.wrappers;
  state = 'unlocked';
}

export const getState = () => state;
export const isUnlocked = () => state === 'unlocked';
export const hasAccount = () => vault.hasAccount();

export async function create(password, confirmPassword) {
  if (await vault.hasAccount()) {
    return { ok: false, error: 'Ya existe una cuenta en este equipo. No se creó nada.' };
  }
  const err = validateNewPassword(password, confirmPassword);
  if (err) return { ok: false, error: err };
  try {
    pending = await vault.prepareNewStore(password);
    state = 'pendingRecoveryConfirm';
    return { ok: true, recoveryKey: pending.recoveryKey, needsRecoveryConfirm: true };
  } catch (e) {
    return { ok: false, error: vault.authErrorMessage(e) };
  }
}

/* Hasta que el usuario confirma que guardó la frase, no se escribe nada a disco. */
export async function confirmRecoverySaved() {
  if (state !== 'pendingRecoveryConfirm' || !pending) {
    return { ok: false, error: 'Operación no permitida.' };
  }
  try {
    await vault.writeStore({}, pending.masterKey, pending.wrappers);
    adopt({
      masterKey: pending.masterKey,
      store: {},
      wrappers: pending.wrappers,
    });
    pending = null;
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo guardar tu cuenta en disco.' };
  }
}

export async function unlock(password) {
  if (!(await vault.hasAccount())) return { ok: false, error: 'No hay datos que desbloquear.' };
  if (typeof password !== 'string' || !password) return { ok: false, error: 'Ingresa tu contraseña.' };
  try {
    adopt(await vault.unlockWithSecret('password', password));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: vault.authErrorMessage(e) };
  }
}

export async function recover(recoveryKey) {
  if (!(await vault.hasAccount())) return { ok: false, error: 'No hay datos que desbloquear.' };
  const normalized = crypto.normalizeRecoveryInput(recoveryKey);
  if (normalized.length !== 40) {
    return { ok: false, error: 'Ingresa tu frase de recuperación completa.' };
  }
  try {
    const unlocked = await vault.unlockWithSecret('recovery', normalized);
    masterKey = unlocked.masterKey;
    storeCache = unlocked.store;
    wrappers = unlocked.wrappers;
    state = 'pendingNewPassword';
    return { ok: true, needsNewPassword: true };
  } catch (e) {
    return { ok: false, error: vault.authErrorMessage(e) };
  }
}

/* La llave maestra no cambia: solo se vuelve a envolver con la contraseña nueva. */
export async function setNewPassword(password, confirmPassword) {
  if (state !== 'pendingNewPassword' || !masterKey) return { ok: false, error: 'Operación no permitida.' };
  const err = validateNewPassword(password, confirmPassword);
  if (err) return { ok: false, error: err };
  try {
    const fresh = await vault.rewrapPassword(masterKey, password);
    const next = { ...wrappers, ...fresh };
    await vault.writeStore(storeCache, masterKey, next);
    wrappers = next;
    state = 'unlocked';
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo guardar la nueva contraseña.' };
  }
}

export function lock() {
  if (masterKey) masterKey.fill(0);
  masterKey = null;
  storeCache = null;
  wrappers = null;
  pending = null;
  state = 'locked';
}

/* ---------- puente de almacenamiento (lo usa app.html) ---------- */
function requireUnlocked() {
  if (state !== 'unlocked' || !storeCache || !masterKey) throw new Error('storage no disponible');
}

function checkKey(key) {
  if (typeof key !== 'string' || !STORAGE_KEY_RE.test(key)) throw new Error('clave inválida');
}

export function storageGet(key) {
  requireUnlocked();
  checkKey(key);
  if (!Object.prototype.hasOwnProperty.call(storeCache, key)) return null;
  return { key, value: storeCache[key], shared: false };
}

export async function storageSet(key, value) {
  requireUnlocked();
  checkKey(key);
  if (typeof value !== 'string') throw new Error('valor inválido');
  const next = { ...storeCache, [key]: value };
  await vault.writeStore(next, masterKey, wrappers);
  storeCache = next;
  return { key, value, shared: false };
}

export async function storageDelete(key) {
  requireUnlocked();
  checkKey(key);
  const existed = Object.prototype.hasOwnProperty.call(storeCache, key);
  const next = { ...storeCache };
  delete next[key];
  await vault.writeStore(next, masterKey, wrappers);
  storeCache = next;
  return { key, deleted: existed, shared: false };
}

/* ---------- bloqueo automático ---------- */
export function getAutoLockMinutes() {
  const raw = storeCache && storeCache.autolock;
  const n = Number(raw);
  return raw !== undefined && AUTOLOCK_OPTIONS.includes(n) ? n : AUTOLOCK_DEFAULT;
}

export async function setAutoLock(minutes) {
  requireUnlocked();
  if (!AUTOLOCK_OPTIONS.includes(minutes)) return { ok: false, error: 'Valor no válido.' };
  try {
    const next = { ...storeCache, autolock: String(minutes) };
    await vault.writeStore(next, masterKey, wrappers);
    storeCache = next;
    return { ok: true, minutes };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'No se pudo guardar el ajuste.' };
  }
}
