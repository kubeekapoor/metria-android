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
y documentado. La biometría es el primer caso de integración profunda con
Android: vive en un plugin local y el núcleo solo ve un puente mínimo
(`biometric.js`). Lo mismo se puede hacer con widgets o notificaciones sin tocar
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
│  Biometría                           src/core/biometric.js     │
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
│  Filesystem · Share · App · MetriaBiometric (local)           │
│  Almacenamiento privado de la app (Directory.Data)            │
│  Android Keystore (llave AES-256-GCM con biometría)           │
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
- `unlockWithMasterKey()`: abre el almacén con una llave maestra ya descifrada
  (la que entrega la biometría). Valida que sea de 32 bytes y lanza `BAD_KEY`.
- `makeStartupBackup()`: copia al arrancar, solo si el archivo cambió, máx. 15.
- `snapshot()`: copia antes de importar, máx. 5.
- Errores tipados: `WRONG_PASSWORD`, `WRONG_RECOVERY`, `BAD_KEY`, `CORRUPT`.

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
   locked ── unlockWithBiometric() ──► unlocked   (llave del Keystore)
   locked ── recover(phrase) ───► pendingNewPassword ── setNewPassword() ──► unlocked
```

- Implementa el contrato `window.storage` (get/set/delete) con validación de
  clave y de sesión desbloqueada.
- Guarda `autolock` dentro del mismo almacén cifrado.
- Expone `biometricStatus()`, `enableBiometric()`, `disableBiometric()` y
  `unlockWithBiometric()`. Al entrar con contraseña o frase avisa al plugin para
  habilitar la biometría tras un reinicio.

### `biometric.js`
- Puente delgado con el plugin nativo `MetriaBiometric`; no guarda secretos.
- `enroll(masterKey)` envía la llave maestra al Keystore para cifrarla;
  `unlock()` recibe la llave descifrada y `noteUnlock()` marca el arranque actual.
- En navegador (desarrollo y pruebas) devuelve “no disponible” sin lanzar
  errores, para que el resto del núcleo funcione igual.

### `MetriaBiometricPlugin.java`
- Usa `androidx.biometric` con `BIOMETRIC_STRONG`.
- Genera una llave AES-256-GCM en el Android Keystore con
  `setUserAuthenticationRequired(true)` y `setInvalidatedByBiometricEnrollment(true)`.
- Guarda en `SharedPreferences` el IV y el texto cifrado de la llave maestra; la
  llave del Keystore nunca sale del sistema.
- `Settings.Global.BOOT_COUNT` detecta reinicios: hasta que el usuario no entra
  con contraseña o frase, `unlock()` responde `PASSWORD_REQUIRED`.
- Se registra manualmente en `MainActivity` antes de `super.onCreate()`.

### `bridges.js`
- Expone a `app.js` los cuatro objetos que esperaba de Electron.
- `getAutoLock()` devuelve una **promesa** (la interfaz usa `.then`).
- `window.security.biometric` ofrece `status`, `enable` y `disable`; `status`
  funciona con la sesión bloqueada porque la pantalla de acceso lo necesita.
- Validación de respaldos: formato `metria-backup`, versión 1 y parámetros scrypt
  exactos, para que un archivo ajeno no imponga un costo enorme.
- Rechaza operaciones si la sesión no está desbloqueada.

### `lock.js`
- Temporizador de inactividad + `visibilitychange` + evento `appStateChange` de
  Capacitor.
- Pasar a segundo plano **no** bloquea al instante: se respeta el ajuste
  (1/5/15/30 min). Con 0 (“Nunca”) no se bloquea sola.
- Al volver se comprueba el tiempo transcurrido porque Android puede pausar los
  temporizadores mientras la app está oculta.
- `beginExternalActivity()` evita contar como inactividad el tiempo que el
  usuario pasa en el selector de archivos o en la hoja de compartir.
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
4. Consulta el estado biométrico y muestra crear cuenta o desbloquear (con
   botón de huella/rostro si está activado y disponible).
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
| Copia de seguridad del sistema filtrando datos | `allowBackup=false`, `fullBackupContent=false` y `dataExtractionRules` que excluyen nube y transferencia entre dispositivos |
| Tráfico de red | Sin permiso `INTERNET`; `usesCleartextTraffic=false` |
| Datos en claro en disco | Archivo cifrado; llave solo en memoria |
| Capturas/segundo plano | Bloqueo tras el tiempo de inactividad configurado; recarga al bloquear |
| Contraseña en el teléfono | No se guarda; la biometría cifra la llave maestra con el Keystore |
| Biometría añadida o cambiada | `setInvalidatedByBiometricEnrollment(true)` invalida la llave y se pide contraseña |
| Reinicio del teléfono | Se pide contraseña una vez (`BOOT_COUNT`); luego vuelve la biometría |
| Archivos de otros apps | `Directory.Data` (privado) y hoja de compartir para exportar |
| WebView con contenido remoto | CSP `default-src 'self'`; sin navegación externa |
| Plugins de más | Solo App, Filesystem, Share y el plugin local de biometría |

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
| `tests/core.test.js` | scrypt/AES compatibles, archivo de escritorio, flujo de auth, llave maestra/biometría, respaldos, corrupción |
| `tests/android-adapter.test.js` | adaptador Capacitor, escritura atómica con fallo de rename, guardar/compartir |
| `tests/ui-smoke.mjs` | crear cuenta, frase, carga de la app, contraseña mala/buena, recuperación |

Lo que **no** cubren: plugins reales en un teléfono, hoja de compartir real,
selector de archivos real, `BiometricPrompt` y bloqueo del sistema. Eso está en
`BACKLOG.md` como pendiente de prueba en dispositivo.

## 9. Limitaciones conocidas

- Solo Android (no iOS) por ahora.
- La biometría requiere Android 7+ con huella/rostro y biometría fuerte; si el
  teléfono solo ofrece biometría débil, la opción no aparece.
- El APK de versión final está firmado con una llave local que debes respaldar.
- La prueba en teléfono físico sigue pendiente.

## 10. Flujo del desbloqueo biométrico

```
Ajustes → activar
  auth.enableBiometric()
    └─ biometric.enroll(masterKey)
         └─ plugin: crea llave AES en Keystore (auth requerida)
              BiometricPrompt → cifra masterKey → guarda IV + ciphertext

Abrir la app (sesión bloqueada)
  boot.js → auth.biometricStatus()
    └─ plugin: supported / available / enabled / requiresPassword
  AuthUI muestra el botón (o pide contraseña tras reiniciar)

Tocar el botón (o auto-prompt)
  auth.unlockWithBiometric()
    └─ plugin: BiometricPrompt → descifra masterKey
         └─ vault.unlockWithMasterKey(masterKey) → data-store.json
              └─ adopt(): llave y datos solo en memoria
```

En ningún paso se escribe la contraseña ni la llave maestra en claro en disco.
