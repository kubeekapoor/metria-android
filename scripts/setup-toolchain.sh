#!/usr/bin/env bash
# Instala el entorno de compilación de Metría Android sin sudo.
#
#   ./scripts/setup-toolchain.sh
#
# Instala en tu carpeta de usuario:
#   ~/.local/opt/jdk-21*   JDK 21 (Temurin)
#   ~/Android/Sdk          Android SDK: platform-tools, android-36, build-tools 36.0.0
#
# No modifica nada del sistema ni pide contraseña.
set -euo pipefail

OPT="$HOME/.local/opt"
SDK="$HOME/Android/Sdk"
JDK_LINK="$OPT/jdk-21"

mkdir -p "$OPT" "$SDK/cmdline-tools"

# --- JDK 21 -----------------------------------------------------------------
if [ -x "$JDK_LINK/bin/java" ]; then
  echo "JDK ya instalado: $JDK_LINK"
else
  echo "== Descargando JDK 21 (Temurin) =="
  tmp="$(mktemp -d)"
  curl -L --fail --retry 2 -o "$tmp/jdk.tar.gz" \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  tar -xzf "$tmp/jdk.tar.gz" -C "$OPT"
  rm -rf "$tmp"
  extracted="$(find "$OPT" -maxdepth 1 -type d -name 'jdk-21*' | head -n1)"
  [ -n "$extracted" ] || { echo "No se pudo extraer el JDK" >&2; exit 1; }
  ln -sfn "$extracted" "$JDK_LINK"
  echo "JDK instalado: $JDK_LINK"
fi

export JAVA_HOME="$JDK_LINK"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

# --- Android SDK ------------------------------------------------------------
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKMANAGER" ]; then
  echo "== Descargando Android command-line tools =="
  tmp="$(mktemp -d)"
  curl -L --fail --retry 2 -o "$tmp/tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -rf "$tmp"
  echo "command-line tools instalado"
fi

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

echo "== Aceptando licencias =="
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null

echo "== Instalando platform-tools, android-36 y build-tools 36.0.0 =="
"$SDKMANAGER" --sdk_root="$SDK" "platform-tools" "platforms;android-36" "build-tools;36.0.0"

echo
echo "Listo. Ahora puedes compilar con:"
echo "  ./scripts/build.sh"
