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

test('desbloqueo con llave maestra (biometría) y rechazo de llave inválida', async () => {
  const fs = freshStore();
  globalThis.__fs = fs;

  const pending = await vault.prepareNewStore('clave-biometrica');
  await vault.writeStore({ tema: 'oscuro', autolock: '5' }, pending.masterKey, pending.wrappers);

  const unlocked = await vault.unlockWithMasterKey(pending.masterKey);
  assert.deepEqual(unlocked.store, { tema: 'oscuro', autolock: '5' });
  assert.equal(crypto.toHex(unlocked.masterKey), crypto.toHex(pending.masterKey));

  /* Borrar el búfer de entrada no debe destruir la llave de la sesión. */
  const before = crypto.toHex(unlocked.masterKey);
  pending.masterKey.fill(0);
  assert.equal(crypto.toHex(unlocked.masterKey), before);
  assert.notEqual(before, '00'.repeat(32));

  await assert.rejects(
    () => vault.unlockWithMasterKey(new Uint8Array(31)),
    (e) => e.code === 'BAD_KEY',
  );
  await assert.rejects(
    () => vault.unlockWithMasterKey(new Uint8Array(32)),
    (e) => e.code === 'CORRUPT',
  );
});

test('biometría no disponible en navegador no rompe el flujo', async () => {
  const biometric = await import('../src/core/biometric.js');
  const st = await biometric.status();
  assert.equal(st.supported, false);
  assert.equal(st.available, false);
  assert.equal(st.enabled, false);
  assert.equal((await biometric.enroll(new Uint8Array(32))).ok, false);
  assert.equal((await biometric.unlock()).ok, false);
  assert.equal((await biometric.disable()).ok, true);
  assert.equal((await auth.biometricStatus()).supported, false);
  assert.equal((await auth.enableBiometric()).ok, false);
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

test('el bloqueo al salir respeta el tiempo de inactividad y "Nunca"', async (t) => {  const listeners = {};
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener(event, fn) { listeners[event] = fn; },
    removeEventListener(event, fn) { if (listeners[event] === fn) delete listeners[event]; },
  };
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const lock = await import('../src/core/lock.js');
  t.after(() => {
    lock.stopAutoLock();
    t.mock.timers.reset();
    delete globalThis.document;
  });

  const events = [];
  let appCallback = null;
  const app = {
    addListener: async (_name, cb) => {
      appCallback = cb;
      return { remove: async () => {} };
    },
  };
  const start = async (minutes) => {
    lock.startAutoLock({ getMinutes: () => minutes, onLock: (r) => events.push(r), app });
    await Promise.resolve();
  };

  /* 5 minutos: pasar a segundo plano no bloquea al instante. */
  await start(5);
  appCallback({ isActive: false });
  assert.deepEqual(events, []);
  t.mock.timers.tick(4 * 60 * 1000);
  assert.deepEqual(events, []);
  t.mock.timers.tick(2 * 60 * 1000);
  assert.deepEqual(events, ['idle']);

  /* Si el temporizador se pausó en segundo plano, al volver se comprueba el
     tiempo transcurrido y se bloquea. */
  events.length = 0;
  await start(5);
  appCallback({ isActive: false });
  t.mock.timers.setTime(Date.now() + 6 * 60 * 1000);
  appCallback({ isActive: true });
  assert.deepEqual(events, ['system']);

  /* 0 = Nunca: no bloquea al salir ni al dejar pasar el tiempo. */
  events.length = 0;
  await start(0);
  appCallback({ isActive: false });
  t.mock.timers.setTime(Date.now() + 60 * 60 * 1000);
  appCallback({ isActive: true });
  t.mock.timers.tick(60 * 60 * 1000);
  assert.deepEqual(events, []);
});

test('flujo biométrico completo con un plugin simulado', async (t) => {
  let storedKey = null;
  const handlers = {
    status: async () => ({
      supported: true,
      available: true,
      enabled: storedKey !== null,
      requiresPassword: false,
      reason: 'OK',
    }),
    enroll: async ({ key }) => { storedKey = key; return { ok: true }; },
    unlock: async () => (storedKey
      ? { ok: true, key: storedKey }
      : { ok: false, code: 'NOT_ENROLLED', error: 'No activado.' }),
    disable: async () => { storedKey = null; return { ok: true }; },
    noteUnlock: async () => ({ ok: true }),
  };

  /* Simula el puente nativo de Capacitor sin Android. */
  globalThis.androidBridge = {};
  globalThis.Capacitor = {
    PluginHeaders: [{
      name: 'MetriaBiometric',
      methods: ['status', 'enroll', 'unlock', 'disable', 'noteUnlock']
        .map(name => ({ name, rtype: 'promise' })),
    }],
    nativePromise: async (_plugin, method, options) => handlers[method](options || {}),
  };
  /* Inicializa Capacitor con el puente simulado antes de usar el plugin. */
  await import('@capacitor/core');
  t.after(() => {
    delete globalThis.Capacitor;
    delete globalThis.androidBridge;
  });

  const fs = freshStore();
  globalThis.__fs = fs;
  assert.equal((await auth.create('clave-biometrica', 'clave-biometrica')).ok, true);
  assert.equal((await auth.confirmRecoverySaved()).ok, true);
  await auth.storageSet('theme', 'dark');

  assert.equal((await auth.biometricStatus()).enabled, false);
  assert.equal((await auth.enableBiometric()).ok, true);
  assert.equal((await auth.biometricStatus()).enabled, true);

  auth.lock();
  assert.equal((await auth.unlockWithBiometric()).ok, true);
  assert.equal(auth.storageGet('theme').value, 'dark');

  /* La llave de la sesión debe seguir sirviendo para escribir: si se borrara
     al terminar el desbloqueo, este guardado rompería el archivo. */
  await auth.storageSet('theme', 'claro');
  auth.lock();
  assert.equal((await auth.unlock('clave-biometrica')).ok, true);
  assert.equal(auth.storageGet('theme').value, 'claro');
});
