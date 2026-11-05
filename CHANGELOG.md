# Changelog — Metría Android

Formato: `YYYY-MM-DD · área · cambio`.

## [1.0.0] — 2026-11-04

### Núcleo
- Proyecto Android nuevo e independiente en `~/apps/metria-android`; no modifica
  el repositorio de escritorio.
- Arquitectura Capacitor 8 + núcleo móvil modular en `src/core/`:
  `crypto`, `fs`, `vault`, `auth`, `bridges`, `lock`, `platform`, `auth-ui`,
  `boot`.
- Cifrado compatible con escritorio: scrypt `N=32768, r=8, p=1` + AES-256-GCM,
  contraseñas normalizadas a NFC, frase de recuperación de 160 bits.
- Archivo `data-store.json` con el mismo formato `format: 1` del escritorio.
- Escritura atómica con `.tmp` + rename y respaldo si el destino no se reemplaza.
- Respaldos automáticos de arranque (máx. 15) y copia previa a importar (máx. 5).
- Máquina de estados de autenticación: crear, confirmar frase, desbloquear,
  recuperar y definir contraseña nueva.
- La cuenta nueva no escribe nada a disco hasta confirmar la frase.
- Bloqueo por inactividad (1/5/15/30 min o nunca; por defecto 5) y al pasar la
  app a segundo plano; al bloquear se recarga la página y se borra la llave.
- Se evita el bloqueo mientras el usuario está en el selector de archivos o en la
  hoja de compartir.

### Interfaz
- Reutiliza `app.js` y `app.css` del escritorio, envueltos en un IIFE con
  `window.MetriaApp = { init, shutdown }`.
- Pantallas de acceso propias con diseño móvil (`auth.css`).
- `mobile.css` para safe areas y edge-to-edge de Android 15/16.
- Exportar respaldo en Android escribe en caché y abre la hoja de compartir.

### Android
- App ID `com.kubeekapoor.metria`, `versionName 1.0.0`, `minSdk 24`,
  `targetSdk 36`.
- Manifiesto endurecido: `allowBackup=false`, `fullBackupContent=false`,
  `dataExtractionRules` (excluye nube y transferencia entre dispositivos),
  `usesCleartextTraffic=false` y sin permiso de INTERNET.
- Íconos adaptativos y splash provisionales a partir de `resources-icon.png`.
- Firma release con `~/.metria-keys/metria-release.jks` y
  `android/keystore.properties` (ambos modo 600).
- APK release generado: `dist/metria-1.0.0-android.apk` (3,7 MB).

### Pruebas y herramientas
- 11 pruebas automatizadas: compatibilidad de crypto con Node/escritorio,
  apertura de archivos del escritorio, flujo completo de auth, respaldos
  bidireccionales, rotación de respaldos, archivo dañado, adaptador Capacitor,
  escritura atómica y guardar/compartir.
- Prueba de humo de interfaz con Playwright + Brave: crear cuenta, frase, carga
  de la app, contraseña incorrecta, desbloqueo y recuperación.
- `scripts/setup-toolchain.sh`: instala JDK 21 y Android SDK 36 sin sudo.
- `scripts/build.sh`: pruebas + compilación + copia del APK a `dist/`.
- Workflow de GitHub Actions para APK debug y release firmado.

### Pendiente
- Probar en un teléfono físico: selector de archivos, hoja de compartir, bloqueo
  al apagar pantalla y comportamiento con teclado/rotación.
- Ícono definitivo (el actual es provisional, igual que en escritorio).
