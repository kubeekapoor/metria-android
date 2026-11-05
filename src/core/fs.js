/* Capa de archivos.
 *
 * En Android usa el plugin Filesystem de Capacitor sobre Directory.Data,
 * que es la carpeta privada de la app (el sistema operativo ya la aísla del
 * resto de aplicaciones: equivalente al 600/700 de escritorio).
 *
 * En navegador (desarrollo) y en pruebas se pueden inyectar adaptadores:
 *   setFileStore(memoryStore())      -> tests de Node
 *   setFileStore(localStorageStore())-> smoke test en navegador
 */

export const DATA_DIR = 'DATA';

/* Capacitor expone window.Capacitor desde @capacitor/core, también en web. */
export function isNative() {
  const cap = globalThis.Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

let adapter = null;

export function setFileStore(next) { adapter = next; }

export function fileStore() {
  if (!adapter) throw new Error('Almacenamiento no inicializado.');
  return adapter;
}

/* ---------- adaptador Capacitor (Android) ----------
 * Recibe los plugins ya importados desde boot.js. En una app Capacitor los
 * proxies de los plugins se crean al importarlos; no basta con mirar
 * window.Capacitor.Plugins. */
export function capacitorStore({ Filesystem, Directory, Encoding }) {
  return {
    async exists(path) {
      try { await Filesystem.stat({ path, directory: Directory.Data }); return true; }
      catch { return false; }
    },
    async readText(path) {
      const res = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
      return res.data;
    },
    async writeText(path, data) {
      await Filesystem.writeFile({ path, data, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
    },
    async remove(path) {
      try { await Filesystem.deleteFile({ path, directory: Directory.Data }); } catch { /* no existía */ }
    },
    async rename(from, to) {
      await Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data });
    },
    async list(dir) {
      try {
        const res = await Filesystem.readdir({ path: dir, directory: Directory.Data });
        return (res.files || []).map(f => f.name);
      } catch { return []; }
    },
    async mkdir(dir) {
      try { await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true }); } catch { /* ya existe */ }
    },
  };
}

/* ---------- adaptador navegador (solo desarrollo) ---------- */
export function localStorageStore(prefix = 'metria.fs.') {
  const key = (p) => prefix + p;
  return {
    async exists(path) { return localStorage.getItem(key(path)) !== null; },
    async readText(path) {
      const v = localStorage.getItem(key(path));
      if (v === null) throw new Error('ENOENT: ' + path);
      return v;
    },
    async writeText(path, data) { localStorage.setItem(key(path), data); },
    async remove(path) { localStorage.removeItem(key(path)); },
    async rename(from, to) {
      const v = localStorage.getItem(key(from));
      if (v === null) throw new Error('ENOENT: ' + from);
      localStorage.setItem(key(to), v);
      localStorage.removeItem(key(from));
    },
    async list(dir) {
      const p = key(dir) + '/';
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(p)) {
          const rest = k.slice(p.length);
          if (rest && !rest.includes('/')) out.push(rest);
        }
      }
      return out;
    },
    async mkdir() { /* plano */ },
  };
}

/* ---------- adaptador en memoria (tests) ---------- */
export function memoryStore(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    _files: files,
    async exists(path) { return files.has(path); },
    async readText(path) {
      if (!files.has(path)) throw new Error('ENOENT: ' + path);
      return files.get(path);
    },
    async writeText(path, data) { files.set(path, String(data)); },
    async remove(path) { files.delete(path); },
    async rename(from, to) {
      if (!files.has(from)) throw new Error('ENOENT: ' + from);
      files.set(to, files.get(from));
      files.delete(from);
    },
    async list(dir) {
      const p = dir ? dir + '/' : '';
      return [...files.keys()].filter(k => k.startsWith(p) && !k.slice(p.length).includes('/'))
        .map(k => k.slice(p.length));
    },
    async mkdir() { /* plano */ },
  };
}
