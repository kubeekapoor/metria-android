# Metria para Android

[![Build APK](https://github.com/kubeekapoor/metria-android/actions/workflows/build-apk.yml/badge.svg)](https://github.com/kubeekapoor/metria-android/actions/workflows/build-apk.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

Aplicación Android de **Metria**, control de finanzas personales por flujo de caja.
Usa la misma interfaz y las mismas reglas financieras que la versión de escritorio
(Electron), con almacenamiento cifrado y respaldos compatibles entre ambas.

- **Paquete:** `com.kubeekapoor.metria`
- **Versión:** 1.2.2
- **Android mínimo:** 7.0 (API 24) · **objetivo:** Android 16 (API 36)
- **APK de versión final:** `dist/metria-1.2.2-android.apk`

## Qué incluye

Paridad funcional con la ficha 1.0.0 del escritorio:

- Contraseña maestra con scrypt + AES-256-GCM.
- Frase de recuperación (no se escribe nada a disco hasta confirmarla).
- Cuentas/métodos de pago, capital inicial, ingresos, gastos, caja chica,
  transferencias con comisión, deudas, abonos y deudas liquidadas.
- Inicio, resumen por periodo, reportes, categorías, edición universal y
  eliminación de cuentas con transferencia o gasto bloqueado.
- Respaldo manual cifrado (exportar/importar `.json`) y copia previa a importar.
- Respaldos automáticos de arranque (últimos 15).
- Modo claro/oscuro, tamaño de vista, aviso de duplicados.
- Bloqueo automático por inactividad (1/5/15/30 min o nunca; por defecto 5). El
  mismo tiempo cuenta cuando la app pasa a segundo plano; con “Nunca” no se
  bloquea sola.
- Desbloqueo con huella o rostro (opcional), con contraseña y frase de
  recuperación como respaldo.
- "Borrar todos tus datos".

Además, en Android:

- Guardar respaldo abre la hoja de compartir del sistema (Archivos, Drive, correo…).
- La app no pide permiso de INTERNET y no tiene tráfico en claro.
- Campos de contraseña preparados para gestores como Proton Pass (atributos
  estándar de autofill y WebView configurada para guardar formularios).

## Desbloqueo con huella o rostro

Se activa en **Ajustes → Seguridad → Desbloqueo rápido**. Requiere que el
teléfono tenga una huella o rostro configurado y una biometría fuerte
(`BIOMETRIC_STRONG`).

- No se guarda la contraseña: se cifra la llave maestra con una llave AES-256-GCM
  del Android Keystore que exige autenticación biométrica.
- Si agregas una huella nueva o cambias la biometría, Android invalida esa llave.
  Metria lo detecta, desactiva el acceso biométrico y pide la contraseña.
- Después de reiniciar el teléfono se pide la contraseña una vez; luego la
  biometría vuelve a funcionar durante ese arranque.
- Si el teléfono solo tiene biometría débil, la opción no aparece.
- La contraseña y la frase de recuperación siempre siguen disponibles.

## Autofill con Proton Pass

Metria es una WebView de Capacitor con origen `https://localhost`. El diálogo
“Use login?” y la opción “Use always” son de Proton Pass, no de Metria.

En 1.1.0 se prepararon los campos (`name`, `autocomplete`, atributos de
contraseña) y la WebView (`IMPORTANT_FOR_AUTOFILL_YES` y
`setSaveFormData(true)`) para que los gestores detecten el formulario. **No se
cambió el hostname `localhost`.**

Si Proton Pass sigue sin recordar “Use always”, la limitación está en cómo el
gestor asocia WebViews con `localhost`; no hay una forma fiable de forzarlo desde
Metria. La contraseña se puede seguir pegando o escribiendo, y el desbloqueo
biométrico evita tener que hacerlo en cada apertura.

> **Estado:** la lógica y la interfaz están probadas de forma automatizada. Falta
> la prueba final en un teléfono físico (biometría, autofill, selector de
> archivos, hoja de compartir y bloqueo real). Ver `BACKLOG.md`.

## Instalar el APK

1. Copia `dist/metria-1.2.2-android.apk` al teléfono (cable, Drive, Telegram…).
2. Ábrelo y acepta "instalar apps de esta fuente" si Android lo pide.
3. Al abrirlo por primera vez, crea tu contraseña maestra y guarda la frase de
   recuperación que te muestra.

El APK está firmado con la llave de este proyecto. **Las actualizaciones deben
firmarse con la misma llave**; consérvala (ver más abajo).

## Compilar

### Todo en uno

```bash
./scripts/setup-toolchain.sh   # solo la primera vez (JDK 21 + Android SDK 36, sin sudo)
./scripts/build.sh             # pruebas + APK firmado en dist/
```

### A mano

```bash
npm install
npm test                       # 16 pruebas de núcleo y compatibilidad
npm run build:web              # empaqueta src/core -> www/dist/boot.js
npm run sync                   # copia www/ al proyecto Android
npm run build:apk              # Gradle: APK release
```

La compilación necesita JDK 21 y Android SDK 36. Si ya los tienes instalados:

```bash
export JAVA_HOME="$HOME/.local/opt/jdk-21"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
npm run build:apk
```

Detalle paso a paso en [`docs/COMPILAR-APK.md`](docs/COMPILAR-APK.md).

### GitHub Actions

`.github/workflows/build-apk.yml` compila el APK en cada push o manualmente.
Genera un APK de depuración siempre y, si existen los secretos de firma, también
el de versión final. Ver el documento de compilación.

Para un repositorio público se recomienda **no** guardar la llave de firma en
GitHub: compila el release localmente y adjúntalo a un GitHub Release.

## Arquitectura

```
src/core/        Núcleo móvil (JavaScript, sin interfaz)
  crypto.js      scrypt + AES-GCM compatibles con escritorio
  fs.js          Adaptadores: Capacitor, localStorage, memoria
  vault.js       Archivo cifrado, escritura atómica, respaldos
  auth.js        Estados de sesión y puente de almacenamiento
  biometric.js   Puente con el plugin nativo de huella/rostro
  bridges.js     window.storage / backup / security / appInfo
  lock.js        Bloqueo por inactividad y segundo plano
  platform.js    Versión, guardar/compartir, actividad externa
  auth-ui.js     Pantallas de acceso
  boot.js        Arranque y orquestación

www/             Interfaz (reutilizada del escritorio)
  app.js         Reglas de negocio y UI financiera
  app.css        Estilos del escritorio
  auth.css       Estilos de acceso
  mobile.css     Safe areas del WebView
  index.html     Contenedor
  vendor/        scrypt-js

android/         Proyecto nativo Capacitor
  app/.../MainActivity.java            Registro del plugin y autofill del WebView
  app/.../MetriaBiometricPlugin.java   Keystore + BiometricPrompt
tests/           Pruebas de núcleo, adaptador y humo de interfaz
```

El detalle de capas, flujos y decisiones está en
[`docs/ARQUITECTURA-ANDROID.md`](docs/ARQUITECTURA-ANDROID.md).

## Compatibilidad con el escritorio

El archivo `data-store.json` y el respaldo `metria-backup` v1 son **idénticos** a
los del escritorio. Las pruebas verifican ambos sentidos:

- un archivo creado por el escritorio se abre en Android;
- un archivo creado en Android se abre en el escritorio;
- los respaldos cifrados se descifran en ambos lados.

Para mover datos: en el escritorio exporta un respaldo cifrado y en Android usa
Ajustes → Importar. También puedes copiar `data-store.json` a la carpeta privada
de la app (requiere acceso root o `adb backup`; lo normal es usar el respaldo).

## Seguridad

- `allowBackup=false`, transferencia entre dispositivos excluida y sin permiso
  de INTERNET.
- Datos en el almacenamiento privado de la app (`Directory.Data`), cifrados en
  disco; la llave maestra solo vive en memoria.
- Bloqueo por inactividad y al pasar a segundo plano, respetando el tiempo
  configurado; al bloquear se recarga la página para borrar llave y datos
  descifrados.
- Desbloqueo biométrico opcional: la llave maestra se cifra con una llave del
  Android Keystore que exige huella/rostro; nunca se guarda la contraseña.
- CSP restrictiva y plugins mínimos (App, Filesystem, Share y el plugin local de
  biometría).

## Firma y actualizaciones

La llave de firma está fuera del repositorio:

```
~/.metria-keys/metria-release.jks        (alias: metria)
android/keystore.properties              (contraseñas; modo 600)
```

**Respalda ambos archivos.** Si se pierden, no se podrá actualizar una instalación
existente: habría que desinstalar y reinstalar (perdiendo los datos locales, que
se recuperan desde un respaldo).

Para una versión nueva, sube `versionCode` y `versionName` en
`android/app/build.gradle` antes de compilar; Android no instala un APK con un
`versionCode` igual o menor sobre el existente.

Para publicar en GitHub sin subir la llave, configura estos secretos:

| Secreto | Contenido |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 ~/.metria-keys/metria-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del almacén |
| `ANDROID_KEY_ALIAS` | `metria` |
| `ANDROID_KEY_PASSWORD` | contraseña de la llave |

## Pruebas

```bash
npm test              # 16 pruebas (crypto, bóveda, auth, biometría, bloqueo, respaldos, adaptador, escritura atómica)
npm run test:ui       # humo de interfaz en Brave/Chromium (requiere puerto 8765)
```

La prueba de interfaz usa `playwright-core` y el Brave instalado; no descarga
navegadores. Comprueba crear cuenta, frase, carga de la app, contraseña incorrecta,
desbloqueo y recuperación.

## Licencia

Este proyecto se distribuye bajo la **GNU Affero General Public License v3.0**
(AGPL-3.0). Puedes usarlo, estudiarlo, modificarlo y redistribuirlo bajo los
términos de esa licencia; si ofreces una versión modificada como servicio en red,
también debes publicar su código. Consulta [`LICENSE`](LICENSE).

© Kubee Kapoor. La aplicación de escritorio es un proyecto separado y conserva
sus propios términos.

Las dependencias de terceros mantienen sus licencias originales; ver
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
