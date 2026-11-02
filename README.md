# ELOQUENT PRO

Academia personal de oratoria, comunicación, vocabulario, negociación y español neutro para Android.
Powered by Korevia.

- `web/`: interfaz, contenido y motores (HTML, CSS y JavaScript sin dependencias).
- `android/`: contenedor nativo en Java: micrófono, Vosk, voz, respaldo y recordatorios.
- `tests/`: pruebas de motores, contenido y recorrido completo.
- `scripts/`: preparación del APK, firma y vista previa.
- `.github/workflows/build-apk.yml`: compila y publica el APK en GitHub Releases.
- `docs/`: manual, documentación técnica, licencias, estado, decisiones y pruebas.

## Compilar

Cada push a `main` compila el APK. También se puede lanzar desde la pestaña Actions.
Antes del primer build, crea la clave fija: `./scripts/setup-signing.sh usuario/eloquent-pro`.

## Probar

    node --test tests/engine.test.js tests/content.test.js
    node tests/e2e.js voz48k.wav capturas        # navegador
    node tests/e2e.js voz48k.wav capturas native # puente Android simulado; requiere voz16.wav junto a voz.wav
