#!/usr/bin/env bash
# Crea una clave de firma fija y la guarda como secretos del repositorio.
# Uso: ./scripts/setup-signing.sh usuario/eloquent-pro
set -euo pipefail
REPO="$1"; DIR="${2:-secrets}"; mkdir -p "$DIR"
PASS="$(openssl rand -hex 16)"
keytool -genkeypair -v -keystore "$DIR/eloquent.jks" -alias eloquent -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=ELOQUENT PRO, O=Korevia, C=CO"
base64 -w0 "$DIR/eloquent.jks" | gh secret set EP_KEYSTORE_B64 -R "$REPO"
printf '%s' "$PASS" | gh secret set EP_KEYSTORE_PASSWORD -R "$REPO"
printf '%s' "$PASS" | gh secret set EP_KEY_PASSWORD -R "$REPO"
printf 'eloquent' | gh secret set EP_KEY_ALIAS -R "$REPO"
printf '%s\n' "$PASS" > "$DIR/clave.txt"
echo "Secretos guardados. Conserva $DIR fuera del repositorio."
