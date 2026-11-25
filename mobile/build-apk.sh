#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# Ponto & Trama — Construtor do APK Android (`mobile/ponto-e-trama.apk`)
# Compila diretamente com Android SDK (aapt2 + javac + d8 + zipalign + apksigner)
# sem precisar de Gradle ou dependências pesadas.
# ==========================================================================

MOBILE_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/.." && pwd)"
ANDROID_DIR="$MOBILE_DIR/android"
ASSETS_FRONTEND="$ANDROID_DIR/assets/frontend"
KEYSTORE="$MOBILE_DIR/ponto-e-trama-debug.keystore"
APK_SAIDA="$MOBILE_DIR/ponto-e-trama.apk"

# Detecta SDK Android
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
if [ ! -d "$SDK_DIR" ] && [ -d "$HOME/.android/sdk" ]; then
  SDK_DIR="$HOME/.android/sdk"
fi

if [ ! -d "$SDK_DIR/build-tools" ] || [ ! -d "$SDK_DIR/platforms" ]; then
  echo "❌ Android SDK não encontrado em: $SDK_DIR"
  echo "   Instale o Android CLI e o SDK mínimo com:"
  echo "   curl -fsSL https://dl.google.com/android/cli/latest/linux_x86_64/install.sh | bash"
  echo "   android sdk install platforms/android-35 build-tools/35.0.0"
  exit 1
fi

BUILD_TOOLS="$(find "$SDK_DIR/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
PLATFORM_DIR="$(find "$SDK_DIR/platforms" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
ANDROID_JAR="$PLATFORM_DIR/android.jar"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

for tool in "$AAPT2" "$D8" "$ZIPALIGN" "$APKSIGNER" "$ANDROID_JAR"; do
  if [ ! -e "$tool" ]; then
    echo "❌ Ferramenta Android SDK ausente: $tool"
    exit 1
  fi
done

echo "🔄 Sincronizando frontend/ -> mobile/android/assets/frontend/..."
rm -rf "$ASSETS_FRONTEND"
mkdir -p "$ASSETS_FRONTEND"
cp -r "$ROOT_DIR/frontend/." "$ASSETS_FRONTEND/"
if [ -f "$ROOT_DIR/scripts/otimizar-build.py" ]; then
  python3 "$ROOT_DIR/scripts/otimizar-build.py" "$ASSETS_FRONTEND"
fi

BUILD_TMP="$(mktemp -d)"
trap 'rm -rf "$BUILD_TMP"' EXIT

mkdir -p "$BUILD_TMP/res-compiled" "$BUILD_TMP/gen" "$BUILD_TMP/classes" "$BUILD_TMP/dex"

echo "📦 Compilando recursos Android (aapt2)..."
"$AAPT2" compile --dir "$ANDROID_DIR/res" -o "$BUILD_TMP/res-compiled/res.zip"
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$ANDROID_DIR/AndroidManifest.xml" \
  -A "$ANDROID_DIR/assets" \
  --java "$BUILD_TMP/gen" \
  -o "$BUILD_TMP/base.apk" \
  "$BUILD_TMP/res-compiled/res.zip"

echo "☕ Compilando MainActivity.java..."
mapfile -t JAVA_SOURCES < <(find "$ANDROID_DIR/java" "$BUILD_TMP/gen" -name '*.java')
javac --release 11 -classpath "$ANDROID_JAR" -d "$BUILD_TMP/classes" "${JAVA_SOURCES[@]}"

echo "⚡ Convertendo bytecode para DEX (d8)..."
mapfile -t CLASS_FILES < <(find "$BUILD_TMP/classes" -name '*.class')
"$D8" --min-api 24 --lib "$ANDROID_JAR" --output "$BUILD_TMP/dex" "${CLASS_FILES[@]}"

echo "🧩 Empacotando classes.dex no APK..."
cp "$BUILD_TMP/base.apk" "$BUILD_TMP/unaligned.apk"
(cd "$BUILD_TMP/dex" && zip -q -u "$BUILD_TMP/unaligned.apk" classes*.dex)

echo "📐 Alinhando APK (zipalign)..."
"$ZIPALIGN" -f -p 4 "$BUILD_TMP/unaligned.apk" "$BUILD_TMP/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "🔑 Gerando chave de assinatura local..."
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass pontoetrama \
    -keypass pontoetrama \
    -alias pontoetrama \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Ponto e Trama, OU=Mobile, O=PontoETrama, L=Local, ST=BR, C=BR" >/dev/null 2>&1
fi

echo "✍️  Assinando APK (apksigner)..."
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:pontoetrama \
  --key-pass pass:pontoetrama \
  --ks-key-alias pontoetrama \
  --out "$APK_SAIDA" \
  "$BUILD_TMP/aligned.apk"

"$APKSIGNER" verify "$APK_SAIDA"
echo "✅ APK pronto para instalar no celular Android: $APK_SAIDA ($(du -h "$APK_SAIDA" | cut -f1))"
