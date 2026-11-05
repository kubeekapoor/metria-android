# Compilar el APK de Metría

Guía completa para generar `dist/metria-1.1.0-android.apk` en Linux, sin `sudo`,
y para reproducirlo en GitHub Actions.

## 1. Requisitos

| Herramienta | Versión | Dónde queda |
|---|---|---|
| Node.js | 22+ | el que ya tengas |
| JDK | 21 | `~/.local/opt/jdk-21` |
| Android SDK | platform 36, build-tools 36.0.0 | `~/Android/Sdk` |
| Gradle | lo trae el wrapper | `android/gradlew` |

No hace falta Android Studio ni permisos de administrador.

## 2. Instalar el entorno (una sola vez)

```bash
cd ~/apps/metria-android
./scripts/setup-toolchain.sh
```

El script:

1. Descarga Temurin JDK 21 en `~/.local/opt` y crea el enlace `jdk-21`.
2. Descarga Android command-line tools en `~/Android/Sdk`.
3. Acepta licencias e instala `platform-tools`, `platforms;android-36` y
   `build-tools;36.0.0`.

Ocupa ~1,5 GB. Es idempotente: si ya existe, no vuelve a descargar.

## 3. Compilar

```bash
./scripts/build.sh
```

Hace, en orden:

1. `npm test` (16 pruebas).
2. `npm run build:apk`:
   - `esbuild src/core/boot.js → www/dist/boot.js`
   - `cap sync android` (copia `www/` y registra plugins)
   - `./gradlew assembleRelease`
3. Copia el APK a `dist/metria-1.1.0-android.apk`.

Para saltar las pruebas:

```bash
./scripts/build.sh --skip-tests
```

### Compilar a mano

```bash
npm install
export JAVA_HOME="$HOME/.local/opt/jdk-21"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_OPTS="-Xmx2g -Dorg.gradle.daemon=false"

npm run build:web
npm run sync
cd android
./gradlew assembleRelease
```

Salidas:

```
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk
```

## 4. Firma

`android/app/build.gradle` lee `android/keystore.properties` si existe:

```properties
storeFile=/home/tu-usuario/.metria-keys/metria-release.jks
storePassword=…
keyAlias=metria
keyPassword=…
```

Si el archivo no existe, Gradle genera un APK **sin firmar** (no instalable en
release). El APK de depuración se firma solo con la llave de debug.

### Crear una llave nueva

Solo si aún no tienes una:

```bash
mkdir -p ~/.metria-keys && chmod 700 ~/.metria-keys
keytool -genkeypair -v \
  -keystore ~/.metria-keys/metria-release.jks \
  -alias metria -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Metría, OU=Metría, O=Kubee Kapoor, C=MX"
```

Guarda la contraseña en `android/keystore.properties` (modo 600) y **respalda
ambos archivos**. Sin la misma llave no se pueden publicar actualizaciones sobre
una instalación existente.

### Publicar una actualización

Antes de compilar una versión nueva, sube ambos números en
`android/app/build.gradle`:

```gradle
versionCode 2          // entero; Android lo usa para decidir si actualiza
versionName "1.1.0"    // el que ve el usuario
```

Android rechaza instalar un APK con el mismo `versionCode` o menor sobre uno ya
instalado. Actualiza también `APP_VERSION` en `src/core/platform.js` si cambia la
versión visible.

### Verificar la firma

```bash
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs \
  dist/metria-1.1.0-android.apk
```

### Ver el manifiesto final

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer" manifest print \
  dist/metria-1.1.0-android.apk | grep -E "allowBackup|Cleartext|permission|versionName"
```

Debe mostrar `allowBackup="false"`, `fullBackupContent="false"`,
`dataExtractionRules`, `usesCleartextTraffic="false"` y ningún
`android.permission.INTERNET`.

## 5. Instalar en el teléfono

Por cable (con depuración USB activada):

```bash
"$ANDROID_HOME/platform-tools/adb" install -r dist/metria-1.1.0-android.apk
```

O copia el APK al teléfono y ábrelo. Android pedirá permitir la instalación desde
esa fuente la primera vez.

Para ver errores en tiempo real:

```bash
"$ANDROID_HOME/platform-tools/adb" logcat | grep -i -E "metria|capacitor|chromium"
```

## 6. GitHub Actions

`.github/workflows/build-apk.yml` se ejecuta en:

- cada push a `main`;
- manualmente desde la pestaña **Actions**;
- al publicar un tag `v*`.

Siempre produce un **APK de depuración** como artefacto descargable. Si están
configurados los secretos, también produce el **APK release firmado** y, al
publicar un tag `v*`, crea el GitHub Release con el APK adjunto.

> **Recomendación para un repo público:** no guardes la llave de firma en los
> secrets del repositorio. Es la identidad de actualización: si se filtra,
> alguien podría publicar una actualización maliciosa. Compila el release en tu
> equipo y súbelo manualmente a GitHub Releases. Si más adelante quieres CI
> firmado, guarda los secretos en un **Environment** llamado `release` con
> revisores requeridos, no a nivel de repositorio.

### Secretos para firma

En GitHub → Settings → Secrets and variables → Actions:

| Secreto | Cómo obtenerlo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 ~/.metria-keys/metria-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del almacén |
| `ANDROID_KEY_ALIAS` | `metria` |
| `ANDROID_KEY_PASSWORD` | contraseña de la llave |

El workflow escribe un `keystore.properties` temporal con rutas absolutas del
runner, compila y borra el archivo al terminar.

## 7. Problemas comunes

**`JAVA_HOME` incorrecto o Java 17**
Gradle 8.14 exige JDK 21. Verifica:

```bash
"$JAVA_HOME/bin/java" -version
```

**No encuentra `platforms/android-36`**
Vuelve a ejecutar `./scripts/setup-toolchain.sh` o instala:

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  --sdk_root="$ANDROID_HOME" "platforms;android-36" "build-tools;36.0.0"
```

**`SDK location not found`**
Exporta `ANDROID_HOME` y `ANDROID_SDK_ROOT`, o crea `android/local.properties`:

```properties
sdk.dir=/home/tu-usuario/Android/Sdk
```

**La app abre en blanco**
Suele ser un error del bundle. Revisa la consola con `adb logcat` o vuelve a
generar `www/dist/boot.js` con `npm run build:web`.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**
La instalación existente está firmada con otra llave. Desinstala la app (perderás
los datos locales; restaura desde un respaldo) o usa la llave original.

**Gradle sin memoria**
Este equipo tiene 7,6 GB. Usa:

```bash
export GRADLE_OPTS="-Xmx2g -Dorg.gradle.daemon=false"
```

## 8. Limpieza

```bash
rm -rf android/.gradle android/build android/app/build dist
npm run build:web
```

No borres `~/.metria-keys/` ni `android/keystore.properties`.
