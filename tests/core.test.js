/* Pruebas del núcleo móvil.
 *
 * Lo importante: comprobar que Android puede leer lo que produce el escritorio
 * y que el escritorio puede leer lo que produce Android. Se usa el crypto de
 * Node como "escritorio" y los módulos de www/core como "Android".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.scrypt = require('scrypt-js');
globalThis.window = globalThis;

const { memoryStore, setFileStore } = await import('../src/core/fs.js');
const crypto = await import('../src/core/crypto.js');
const vault = await import('../src/core/vault.js');
const auth = await import('../src/core/auth.js');
const { installBridges } = await import('../src/core/bridges.js');

const N = 32768, R = 8, P = 1;
const nodeScrypt = (secret, saltHex) => nodeCrypto.scryptSync(
  Buffer.from(String(secret).normalize('NFC'), 'utf8'),
  Buffer.from(saltHex, 'hex'),
  32,
  { N, r: R, p: P, maxmem: 128 * N * R * 2 },
);

function nodeEncrypt(bytes, key) {
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

function nodeDecrypt(w, key) {
  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(w.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(w.authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(w.ciphertext, 'hex')), decipher.final()]);
}

/* Reproduce exactamente lo que escribe main.js en el escritorio. */
function desktopStoreFile({ password, recoveryKey, store }) {
  const masterKey = nodeCrypto.randomBytes(32);
  const passwordSalt = nodeCrypto.randomBytes(16).toString('hex');
  const recoverySalt = nodeCrypto.randomBytes(16).toString('hex');
  const normalizedRecovery = recoveryKey.toUpperCase().replace(/[^0-9A-F]/g, '');
  const wrappedByPassword = nodeEncrypt(masterKey, nodeScrypt(password, passwordSalt));
  const wrappedByRecovery = nodeEncrypt(masterKey, nodeScrypt(normalizedRecovery, recoverySalt));
  const data = nodeEncrypt(Buffer.from(JSON.stringify(store), 'utf8'), masterKey);
  return JSON.stringify({ format: 1, passwordSalt, recoverySalt, wrappedByPassword, wrappedByRecovery, data });
}

function freshStore(initial = {}) {
  const store = memoryStore(initial);
  setFileStore(store);
  auth.lock();
  return store;
}

test('scrypt móvil coincide con el escritorio, incluso con acentos y ñ', async () => {
  const salt = nodeCrypto.randomBytes(16).toString('hex');
  const password = 'ñandú-ÁÉÍÓÚ-2026';
  const mobile = await crypto.deriveKey(password, salt);
  const desktop = nodeScrypt(password, salt);
  assert.equal(crypto.toHex(mobile), desktop.toString('hex'));
});

test('AES-256-GCM es interoperable en ambos sentidos', async () => {
  const key = nodeCrypto.randomBytes(32);
  const text = 'movimientos con ñ, acentos y emoji 💰';

  const fromNode = nodeEncrypt(Buffer.from(text, 'utf8'), key);
  assert.equal(await crypto.decryptText(fromNode, key), text);

  const fromMobile = await crypto.encryptText(text, key);
  assert.equal(nodeDecrypt(fromMobile, key).toString('utf8'), text);
});

test('un data-store.json del escritorio se abre en Android', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;
  const password = 'contraseña-segura';
  const recoveryKey = crypto.generateRecoveryKey();
  const store = {
    data: JSON.stringify({ entries: [{ id: 'e1', type: 'ingreso', amount: 100 }], debts: [], paymentMethods: [], categories: [] }),
    theme: 'dark',
    autolock: '15',
  };
  const raw = desktopStoreFile({ password, recoveryKey, store });
  await globalThis.__fs.writeText(vault.DATA_FILE, raw);

  const byPassword = await vault.unlockWithSecret('password', password);
  assert.deepEqual(byPassword.store, store);

  const byRecovery = await vault.unlockWithSecret('recovery', crypto.normalizeRecoveryInput(recoveryKey));
  assert.deepEqual(byRecovery.store, store);

  await assert.rejects(
    () => vault.unlockWithSecret('password', 'incorrecta'),
    (e) => e.code === 'WRONG_PASSWORD',
  );
  await assert.rejects(
    () => vault.unlockWithSecret('recovery', '0'.repeat(40)),
    (e) => e.code === 'WRONG_RECOVERY',
  );
});

test('flujo completo: crear, confirmar frase, guardar, bloquear, desbloquear y recuperar', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;

  const created = await auth.create('clave-de-prueba', 'clave-de-prueba');
  assert.equal(created.ok, true);
  assert.match(created.recoveryKey, /^[0-9A-F]{4}(-[0-9A-F]{4}){9}$/);
  assert.equal(await fs.exists(vault.DATA_FILE), false, 'no debe escribir hasta confirmar la frase');

  assert.equal((await auth.confirmRecoverySaved()).ok, true);
  assert.equal(await fs.exists(vault.DATA_FILE), true);

  assert.equal((await auth.storageSet('data', JSON.stringify({ entries: [{ id: 'a' }], debts: [], paymentMethods: [], categories: [] }))).value !== undefined, true);
  assert.equal((await auth.storageSet('theme', 'dark')).key, 'theme');
  assert.equal(auth.storageGet('theme').value, 'dark');

  auth.lock();
  assert.equal((await auth.unlock('mala')).error, 'Contraseña incorrecta.');
  assert.equal((await auth.unlock('clave-de-prueba')).ok, true);
  assert.equal(auth.storageGet('theme').value, 'dark');

  auth.lock();
  assert.equal((await auth.recover('0000-0000')).error, 'Ingresa tu frase de recuperación completa.');
  assert.equal((await auth.recover(created.recoveryKey)).ok, true);
  assert.equal((await auth.setNewPassword('clave-nueva-1', 'clave-nueva-1')).ok, true);

  auth.lock();
  assert.equal((await auth.unlock('clave-de-prueba')).error, 'Contraseña incorrecta.');
  assert.equal((await auth.unlock('clave-nueva-1')).ok, true);
});

test('respaldo cifrado móvil <-> escritorio', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;
  assert.equal((await auth.create('clave-de-prueba', 'clave-de-prueba')).ok, true);
  assert.equal((await auth.confirmRecoverySaved()).ok, true);
  installBridges({});

  const payload = JSON.stringify({ entries: [{ id: 'e1' }], debts: [], paymentMethods: [], categories: [] });
  const out = await globalThis.window.backup.encrypt(payload, 'clave-respaldo');
  assert.equal(out.ok, true);
  const file = JSON.parse(out.file);
  assert.equal(file.format, 'metria-backup');
  assert.deepEqual(file.kdf, { name: 'scrypt', N, r: R, p: P });

  /* El escritorio descifra el respaldo hecho en Android. */
  const desktopPlain = nodeDecrypt(file, nodeScrypt('clave-respaldo', file.salt)).toString('utf8');
  assert.equal(desktopPlain, payload);

  /* Android descifra un respaldo hecho con el código del escritorio. */
  const salt = nodeCrypto.randomBytes(16).toString('hex');
  const desktopFile = JSON.stringify({
    format: 'metria-backup', version: 1, kdf: { name: 'scrypt', N, r: R, p: P }, salt,
    ...nodeEncrypt(Buffer.from(payload, 'utf8'), nodeScrypt('otra-clave', salt)),
  });
  const back = await globalThis.window.backup.decrypt(desktopFile, 'otra-clave');
  assert.equal(back.ok, true);
  assert.equal(back.payload, payload);
  assert.equal((await globalThis.window.backup.decrypt(desktopFile, 'mala')).ok, false);
});

test('respaldos automáticos: solo si cambió y máximo 15', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;
  await fs.writeText(vault.DATA_FILE, '{"format":1}');
  await vault.makeStartupBackup();
  await vault.makeStartupBackup();
  assert.equal((await fs.list(vault.BACKUPS_DIR)).length, 1);

  for (let i = 0; i < 20; i++) {
    await fs.writeText(vault.DATA_FILE, `{"format":1,"n":${i}}`);
    await vault.makeStartupBackup();
  }
  assert.equal((await fs.list(vault.BACKUPS_DIR)).length, vault.MAX_BACKUPS);
});

test('copia previa a importar: máximo 5', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;
  await fs.writeText(vault.DATA_FILE, '{"format":1}');
  for (let i = 0; i < 8; i++) await vault.snapshot();
  assert.equal((await fs.list(vault.BACKUPS_DIR)).filter(f => f.startsWith('pre-import-')).length, vault.MAX_PRE_IMPORT);
});

test('rechaza un archivo dañado sin tocarlo', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;
  await fs.writeText(vault.DATA_FILE, '{"format":1,"passwordSalt":');
  await assert.rejects(
    () => vault.unlockWithSecret('password', 'cualquiera'),
    (e) => e.code === 'CORRUPT',
  );
});
