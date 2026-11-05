# Arquitectura de Metría Android

Este documento explica cómo está armada la app, por qué se eligió Capacitor y
dónde tocar cada cosa cuando quieras escalarla.

## 1. Decisión: Capacitor + núcleo modular

La app de escritorio es una SPA (`app.html`) que concentra toda la interfaz y las
reglas financieras, y delega en Electron cuatro cosas: almacenamiento cifrado,
respaldos, bloqueo y datos de la app.

Reescribir eso en Kotlin duplicaría ~3.000 líneas de reglas ya probadas y abriría
la puerta a que Android y escritorio calculen distinto. En cambio:

- **Se reutiliza tal cual** la interfaz y la lógica financiera (`www/app.js`).
- **Se reimplementa solo el borde**: cifrado, archivos, autenticación, respaldos,
  bloqueo y plataforma (`src/core/`).
- El contrato entre ambos es el mismo que ya usaba Electron (`window.storage`,
  `window.backup`, `window.security`, `window.appInfo`).

Así hay **una sola fuente de verdad financiera** y el núcleo móvil queda aislado
y documentado. Si algún día hace falta integración profunda con Android
(Keystore, biometría, widgets), se puede sustituir un módulo del núcleo sin tocar
`app.js`.

## 2. Capas

```
┌──────────────────────────────────────────────────────────────┐
│  Interfaz + reglas financieras       www/app.js  (sin cambios)│
│  Estilos                             www/app.css, auth.css,   │
│                                      mobile.css               │
└───────────────────────────┬──────────────────────────────────┘
                            │ contrato tipo Electron
                            │ window.storage / backup /
                            │ security / appInfo
┌───────────────────────────▼──────────────────────────────────┐
│  Puentes                             src/core/bridges.js       │
├──────────────────────────────────────────────────────────────┤
│  Sesión y autenticación              src/core/auth.js          │
│  Bóveda y respaldos                  src/core/vault.js         │
│  Cifrado                             src/core/crypto.js        │
│  Archivos                            src/core/fs.js            │
│  Bloqueo                             src/core/lock.js          │
│  Plataforma                          src/core/platform.js      │
├──────────────────────────────────────────────────────────────┤
│  Arranque y pantallas de acceso      src/core/boot.js,         │
│                                      src/core/auth-ui.js       │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Capacitor (WebView + plugins)                                │
│  Filesystem · Share · App                                     │
│  Almacenamiento privado de la app (Directory.Data)            │
└──────────────────────────────────────────────────────────────┘
```

## 3. Responsabilidad de cada módulo

### `crypto.js`
- scrypt con `N=32768, r=8, p=1` (mismos parámetros que el escritorio).
- AES-256-GCM con IV de 12 bytes; devuelve `{ iv, authTag, ciphertext }` en hex.
- Normaliza contraseñas a Unicode NFC antes de derivar.
- Genera la frase de recuperación (160 bits en hex, agrupados de 4).
- scrypt no está en WebCrypto: se usa `vendor/scrypt.js` (script clásico que
  expone `window.scrypt`).

### `fs.js`
- Define el contrato mínimo de archivos: `exists`, `readText`, `writeText`,
  `remove`, `rename`, `list`, `mkdir`.
- `capacitorStore()` implementa ese contrato con el plugin Filesystem sobre
  `Directory.Data`.
- `localStorageStore()` y `memoryStore()` permiten desarrollar y probar sin
  Android. La interfaz no sabe cuál está activo.

### `vault.js`
- Formato de archivo idéntico al escritorio (`format: 1`, dos sales, dos
  envolturas de la llave maestra y `data`).
- `writeAtomic()`: escribe `.tmp` y renombra; si el destino no se puede
  reemplazar, borra y renombra (ventana mínima).
- `makeStartupBackup()`: copia al arrancar, solo si el archivo cambió, máx. 15.
- `snapshot()`: copia antes de importar, máx. 5.
- Errores tipados: `WRONG_PASSWORD`, `WRONG_RECOVERY`, `CORRUPT`.

### `auth.js`
- Máquina de estados y llave maestra **solo en memoria**.

```
                 create()
   locked ─────────────────► pendingRecoveryConfirm
     ▲                              │ confirmRecoverySaved()
     │                              ▼
     │                          unlocked
     │                              │
     │  lock()                      │
     └──────────────────────────────┘

   locked ── unlock(password) ──► unlocked
   locked ── recover(phrase) ───► pendingNewPassword ── setNewPassword() ──► unlocked
```

- Implementa el contrato `window.storage` (get/set/delete) con validación de
  clave y de sesión desbloqueada.
- Guarda `autolock` dentro del mismo almacén cifrado.

### `bridges.js`
- Expone a `app.js` los cuatro objetos que esperaba de Electron.
- `getAutoLock()` devuelve una **promesa** (la interfaz usa `.then`).
- Validación de respaldos: formato `metria-backup`, versión 1 y parámetros scrypt
  exactos, para que un archivo ajeno no imponga un costo enorme.
- Rechaza operaciones si la sesión no está desbloqueada.

### `lock.js`
- Temporizador de inactividad + `visibilitychange` + evento `appStateChange` de
  Capacitor.
- `beginExternalActivity()` evita bloquear mientras el usuario está en el
  selector de archivos o en la hoja de compartir.
- Al bloquear: `MetriaApp.shutdown()` limpia el DOM y `location.reload()` borra
  llave y datos descifrados de la memoria.

### `platform.js`
- Versión real vía plugin App.
- Exportar respaldo: escribe en caché y abre la hoja de compartir.
- En navegador (desarrollo) usa descarga clásica.
- `waitForCapacitor()` espera el puente nativo antes de arrancar.

### `boot.js`
1. Configura los plugins importados (`@capacitor/core`, `app`, `filesystem`,
   `share`) y espera el puente.
2. Elige adaptador de archivos (Capacitor o localStorage).
3. Hace el respaldo de arranque.
4. Muestra crear cuenta o desbloquear.
5. Solo al entrar carga `app.css`, `mobile.css` y `app.js`, arranca la interfaz y
   el bloqueo automático.

## 4. Por qué esbuild

Capacitor registra los plugins cuando se **importan** desde JavaScript; mirar
`window.Capacitor.Plugins` no basta en el primer arranque. Por eso `src/core`
se escribe como módulos ES y se empaqueta a un solo `www/dist/boot.js` con
esbuild. El APK no incluye el código fuente del núcleo: solo el bundle.

`www/` se copia al proyecto Android con `cap sync`. `www/dist` está ignorado por
git y se regenera en cada compilación.

## 5. Seguridad

| Riesgo | Decisión |
|---|---|
| Copia de seguridad del sistema filtrando datos | `allowBackup=false` |
| Tráfico de red | Sin permiso `INTERNET`; `usesCleartextTraffic=false` |
| Datos en claro en disco | Archivo cifrado; llave solo en memoria |
| Capturas/segundo plano | Bloqueo al salir; recarga al bloquear |
| Archivos de otros apps | `Directory.Data` (privado) y hoja de compartir para exportar |
| WebView con contenido remoto | CSP `default-src 'self'`; sin navegación externa |
| Plugins de más | Solo App, Filesystem y Share |

Nota: el WebView y el archivo cifrado protegen los datos en reposo, pero un
teléfono con root podría volcar la memoria de la app desbloqueada. Es el mismo
modelo de amenaza que el escritorio.

## 6. Compatibilidad de datos

`data-store.json` (Android y escritorio):

```json
{
  "format": 1,
  "passwordSalt": "32 hex",
  "recoverySalt": "32 hex",
  "wrappedByPassword": { "iv": "24 hex", "authTag": "32 hex", "ciphertext": "…" },
  "wrappedByRecovery": { "iv": "24 hex", "authTag": "32 hex", "ciphertext": "…" },
  "data":              { "iv": "24 hex", "authTag": "32 hex", "ciphertext": "…" }
}
```

Respaldo `metria-backup` v1:

```json
{
  "format": "metria-backup",
  "version": 1,
  "kdf": { "name": "scrypt", "N": 32768, "r": 8, "p": 1 },
  "salt": "32 hex",
  "iv": "24 hex",
  "authTag": "32 hex",
  "ciphertext": "…"
}
```

Las pruebas (`tests/core.test.js`) generan archivos con el crypto de Node —igual
que `main.js`— y los abren con el núcleo móvil, y viceversa.

## 7. Cómo escalar

### Añadir una pantalla o función financiera
Casi siempre se toca solo `www/app.js` y `www/app.css`, replicando el cambio del
escritorio. No hay que tocar el núcleo.

### Añadir una capacidad nativa
1. Instala el plugin: `npm install @capacitor/<plugin>`.
2. Impórtalo en `src/core/boot.js` y pásalo a `configurePlatform()` o al módulo
   que lo use.
3. Expón una función mínima; no des acceso directo a `window` desde `app.js`.
4. Añade una prueba con un plugin simulado en `tests/`.
5. `npm run sync` y compila.

### Cambiar el formato de datos
Sube `FORMAT_VERSION` en `crypto.js`, añade migración en `vault.js` y una prueba
que abra el formato anterior. Mantén la lectura del formato 1.

### Migrar el núcleo a Kotlin
Sustituye `fs.js`, `crypto.js` y `lock.js` por un plugin propio que implemente el
mismo contrato. `app.js` y `bridges.js` no cambian.

## 8. Pruebas

| Archivo | Qué cubre |
|---|---|
| `tests/core.test.js` | scrypt/AES compatibles, archivo de escritorio, flujo de auth, respaldos, corrupción |
| `tests/android-adapter.test.js` | adaptador Capacitor, escritura atómica con fallo de rename, guardar/compartir |
| `tests/ui-smoke.mjs` | crear cuenta, frase, carga de la app, contraseña mala/buena, recuperación |

Lo que **no** cubren: plugins reales en un teléfono, hoja de compartir real,
selector de archivos real y bloqueo del sistema. Eso está en `BACKLOG.md` como
pendiente de prueba en dispositivo.

## 9. Limitaciones conocidas

- Solo Android (no iOS) por ahora.
- Sin biometría ni Keystore de Android; la contraseña maestra es el factor único.
- El APK de versión final está firmado con una llave local que debes respaldar.
- La prueba en teléfono físico sigue pendiente.
