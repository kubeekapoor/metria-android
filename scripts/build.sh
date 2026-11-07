#!/usr/bin/env bash
# Compila el APK de versión final de Metría.
#
# Uso:
#   ./scripts/build.sh            # pruebas + APK release
#   ./scripts/build.sh --skip-tests
#
# Requisitos: Node 22+, JDK 21 y Android SDK 36.
# Si no los tienes, ejecuta primero: ./scripts/setup-toolchain.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Entorno local sin sudo -------------------------------------------------
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -x "$HOME/.local/opt/jdk-21/bin/java" ]; then
    JAVA_HOME="$HOME/.local/opt/jdk-21"
  else
    JAVA_HOME="$HOME/.local/opt/jdk-21.0.13+9"
  fi
fi
export JAVA_HOME
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export GRADLE_OPTS="${GRADLE_OPTS:--Xmx2g -Dorg.gradle.daemon=false}"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "No encuentro Java en $JAVA_HOME" >&2
  echo "Ejecuta ./scripts/setup-toolchain.sh o define JAVA_HOME." >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo "No encuentro Android SDK 36 en $ANDROID_HOME" >&2
  echo "Ejecuta ./scripts/setup-toolchain.sh o define ANDROID_HOME." >&2
  exit 1
fi

if [ ! -f android/keystore.properties ]; then
  echo "Aviso: no hay android/keystore.properties; el APK saldrá sin firmar." >&2
fi

# --- Pruebas ----------------------------------------------------------------
if [ "${1:-}" != "--skip-tests" ]; then
  echo "== Pruebas del núcleo =="
  npm test
fi

# --- Compilación ------------------------------------------------------------
echo "== Compilando APK =="
npm run build:apk

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/metria-1.2.1-android.apk

echo
echo "APK listo: dist/metria-1.2.1-android.apk"
ls -lh dist/metria-1.2.1-android.apk
