# Documentación técnica

## Arquitectura
| Capa | Archivos | Función |
| --- | --- | --- |
| Interfaz | `web/js/ui/*` | Pantallas, navegación y grabador |
| Sistema educativo | `web/js/content/*` | Niveles, palabras, temas y escenarios |
| Evaluación | `engine/analysis.js`, `engine/exams.js` | Métricas, retroalimentación y aprobación |
| Repetición espaciada | `engine/srs.js` | SM-2 y estados de cada palabra |
| Simulador | `engine/sim.js` | Guiones ramificados |
| Plataforma | `web/js/platform.js` | Android o navegador |
| Android | `android/.../*.java` | WebView, Vosk, TextToSpeech, archivos, alarmas |

La interfaz se sirve desde `https://appassets.androidplatform.net/www/`. Los audios se sirven en `/rec/<id>.wav`.

## Flujo de una toma
`AudioRecord` a 16 kHz → WAV en `files/rec` + Vosk en vivo → evento `recDone` → JavaScript descarga el WAV → pausas, tono e intensidad → informe.

## Almacenamiento
Estado en IndexedDB, con copia en `files/state.json`. Respaldo: zip con el estado y los audios.

## Tamaño estimado
Modelo: 39 MB comprimido y cerca de 300 MB de RAM en uso, según Vosk. El tamaño real del APK se confirma en la primera compilación.

## Agregar contenido
Las palabras están en `content/words*.js`, y los escenarios en `content/scenarios.js`. Las pruebas `tests/content.test.js` validan su forma.
