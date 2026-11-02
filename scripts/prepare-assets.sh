#!/usr/bin/env bash
# Copia la interfaz y el modelo de voz a los assets del APK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/android/app/src/main/assets"
rm -rf "$A/www"; mkdir -p "$A"
cp -r "$ROOT/web" "$A/www"
if [ ! -d "$A/model-es" ]; then
  T="$(mktemp -d)"
  curl -fsSL --retry 3 -o "$T/m.zip" https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
  unzip -q "$T/m.zip" -d "$T"
  mv "$T/vosk-model-small-es-0.42" "$A/model-es"
  rm -rf "$T"
fi
du -sh "$A/model-es"
