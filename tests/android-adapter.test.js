/* Pruebas del adaptador de archivos y de la plataforma con plugins simulados.
 * No sustituyen una prueba en teléfono, pero validan el contrato con Capacitor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { capacitorStore, memoryStore, setFileStore } from '../src/core/fs.js';
import * as vault from '../src/core/vault.js';

const Directory = { Data: 'DATA', Cache: 'CACHE' };
const Encoding = { UTF8: 'utf8' };

function mockFilesystem({ failFirstRename = false } = {}) {
  const files = new Map();
  let renamed = 0;
  return {
    _files: files,
    async stat({ path }) { if (!files.has(path)) throw new Error('ENOENT'); return { size: files.get(path).length }; },
    async readFile({ path }) { if (!files.has(path)) throw new Error('ENOENT'); return { data: files.get(path) }; },
    async writeFile({ path, data }) { files.set(path, data); },
    async deleteFile({ path }) { if (!files.has(path)) throw new Error('ENOENT'); files.delete(path); },
    async rename({ from, to }) {
      renamed++;
      if (failFirstRename && renamed === 1) throw new Error('EEXIST');
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from));
      files.delete(from);
    },
    async readdir({ path }) {
      const prefix = path ? path + '/' : '';
      const out = [];
      for (const k of files.keys()) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          if (rest && !rest.includes('/')) out.push({ name: rest, type: 'file' });
        }
      }
      if (!out.length) throw new Error('ENOENT');
      return { files: out };
    },
    async mkdir() { /* no-op */ },
  };
}

test('adaptador Capacitor: escribir, leer, listar, renombrar y borrar', async () => {
  const store = capacitorStore({ Filesystem: mockFilesystem(), Directory, Encoding });
  assert.equal(await store.exists('data-store.json'), false);
  await store.writeText('data-store.json', '{"a":1}');
  assert.equal(await store.exists('data-store.json'), true);
  assert.equal(await store.readText('data-store.json'), '{"a":1}');
  await store.mkdir('backups');
  await store.writeText('backups/data-store-1.json', 'x');
  assert.deepEqual(await store.list('backups'), ['data-store-1.json']);
  await store.rename('data-store.json', 'data-store.json.tmp');
  assert.equal(await store.exists('data-store.json'), false);
  assert.equal(await store.readText('data-store.json.tmp'), '{"a":1}');
  await store.remove('data-store.json.tmp');
  assert.equal(await store.exists('data-store.json.tmp'), false);
  assert.deepEqual(await store.list('no-existe'), []);
});

test('escritura atómica usa el respaldo si renombrar sobre el destino falla', async () => {
  const fs = capacitorStore({ Filesystem: mockFilesystem({ failFirstRename: true }), Directory, Encoding });
  setFileStore(fs);
  await fs.writeText(vault.DATA_FILE, '{"viejo":1}');
  await vault.writeAtomic('{"nuevo":1}');
  assert.equal(await fs.readText(vault.DATA_FILE), '{"nuevo":1}');
  assert.equal(await fs.exists(vault.TMP_FILE), false);
});

test('plataforma: guardar respaldo usa caché y hoja de compartir', async () => {
  globalThis.window = globalThis;
  globalThis.Capacitor = { isNativePlatform: () => true };
  const { platform, configurePlatform } = await import('../src/core/platform.js');
  const written = [];
  const shared = [];
  configurePlatform({
    App: { getInfo: async () => ({ version: '1.0.0' }) },
    Share: { share: async (opts) => { shared.push(opts); } },
    Filesystem: {
      writeFile: async (opts) => { written.push(opts); },
      getUri: async ({ path, directory }) => ({ uri: `file:///cache/${path}` }),
    },
    Directory,
    Encoding,
  });
  const res = await platform.saveFile('{"x":1}', 'metria-respaldo.json');
  assert.deepEqual(res, { ok: true });
  assert.equal(written.length, 1);
  assert.equal(written[0].directory, 'CACHE');
  assert.equal(written[0].encoding, 'utf8');
  assert.deepEqual(shared[0].files, ['file:///cache/metria-respaldo.json']);
  assert.equal(await platform.version(), '1.0.0');
  assert.equal(platform.isExternalActivity(), true);
  platform.endExternalActivity();
  assert.equal(platform.isExternalActivity(), false);
});
