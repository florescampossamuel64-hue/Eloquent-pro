# Decisiones

| Decisión | Razón |
| --- | --- |
| Interfaz web en WebView, no Flutter | No hay SDK de Flutter en el entorno de desarrollo. Así la lógica y las pantallas se prueban a fondo en Chromium. |
| Contenedor Java, no Kotlin | Se puede revisar con javac sin Android SDK. |
| Vosk small-es incluido en el APK | Funciona desde la primera apertura, sin pasos de descarga. Error publicado: 11 a 17 %. |
| Whisper queda fuera de la versión 1 | Se agregará solo si Vosk resulta insuficiente en las pruebas del teléfono. |
| IA local queda fuera de la versión 1 | Velocidad de referencia de 5 a 7 tokens por segundo en un teléfono parecido. Falta prueba real. |
| Guiones ramificados para simular | Funcionan sin IA y se etiquetan como tales. |
| Android TextToSpeech | Sin descarga adicional. Piper exigiría revisar eSpeak NG (GPLv3). |
| Solo ARM64 | Es la arquitectura del teléfono y reduce el APK. |
| targetSdk 34 | Evita cambios de diseño de pantalla completa de la 35. No afecta la instalación directa. |
| PIN sin huella en la versión 1 | Menos dependencias. La huella queda pendiente. |
| Video con la cámara del teléfono | La app graba y evalúa audio con teleprompter. Grabar video queda pendiente. |
