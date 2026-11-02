/* Aprobación por dominio demostrado: cada nivel publica sus criterios antes de la prueba
   y exige aprobar en dos días distintos. */
(function (root) {
  const EP = root.EP = root.EP || {};
  const X = EP.exams = {};
  X.check = function (c, r, self) {
    const a = r.audio, t = r.text, s = r.structure;
    const yes = (val, measured, tag) => ({ ok: !!val, value: measured, tag: tag || 'estimado' });
    switch (c.type) {
      case 'minSeconds': return yes(a && a.durationSec >= c.value, a ? Math.round(a.durationSec) + ' s' : 'sin audio', 'medido');
      case 'maxBlock': return yes(a && a.longestPause <= c.value, a ? a.longestPause.toFixed(1) + ' s' : 'sin audio', 'medido');
      case 'startWithin': return yes(a && a.firstSpeechSec <= c.value, a ? a.firstSpeechSec.toFixed(1) + ' s' : 'sin audio', 'medido');
      case 'structure': return yes(s.parts >= c.value, s.parts + ' de 3 partes');
      case 'reason': return yes(s.reason || s.example, s.reason || s.example ? 'detectado' : 'no detectado');
      case 'closing': return yes(s.closing, s.closing ? 'detectado' : 'no detectado');
      case 'connectors': return yes(t.connectorTypes >= c.value, t.connectorTypes + ' tipos');
      case 'maxFillersPerMin': return yes(r.fillersPerMin != null && r.fillersPerMin <= c.value, r.fillersPerMin == null ? 'sin texto' : r.fillersPerMin + ' por minuto');
      case 'minVariety': return yes(t.variety >= c.value, Math.round(t.variety * 100) + ' %');
      case 'pitchVariation': return yes(a && a.pitch && a.pitch.variationSemis >= c.value, a && a.pitch ? a.pitch.variationSemis + ' semitonos' : 'no medible', 'medido');
      case 'readingMatch': return yes(r.reading != null && r.reading >= c.value, r.reading == null ? 'sin texto' : r.reading + ' %');
      case 'self': return { ok: !!(self && self[c.id]), value: self && self[c.id] ? 'sí' : 'no', tag: 'autoevaluacion' };
      default: return { ok: false, value: 'criterio desconocido', tag: 'estimado' };
    }
  };
  /* Si el ruido invalida el audio, la toma no cuenta: ni aprueba ni reprueba. */
  X.evaluateTask = function (task, r, self) {
    const needsAudio = task.criteria.some(c => ['minSeconds', 'maxBlock', 'startWithin', 'pitchVariation'].includes(c.type));
    if (needsAudio && !r.audio) return { valid: false, reason: 'Esta parte exige grabar tu voz. Hazla en un lugar tranquilo.', results: [], passed: false };
    if (needsAudio && r.audio.tooQuiet) return { valid: false, reason: 'Casi no se oye voz en la toma. Repite cerca del teléfono.', results: [], passed: false };
    const needsText = task.criteria.some(c => ['structure', 'reason', 'closing', 'connectors', 'maxFillersPerMin', 'minVariety', 'readingMatch'].includes(c.type));
    if (needsText && !r.hasTranscript) return { valid: false, reason: 'Falta la transcripción. Escríbela o corrígela para evaluar la toma.', results: [], passed: false };
    const results = task.criteria.map(c => Object.assign({ label: c.label, type: c.type }, X.check(c, r, self)));
    return { valid: true, results, passed: results.every(x => x.ok) };
  };
  X.levelStatus = function (levels, attempts) {
    const out = {};
    let open = true;
    for (const lv of levels) {
      const days = new Set((attempts[lv.id] || []).filter(a => a.passed).map(a => a.day));
      const passed = days.size >= 2;
      out[lv.id] = { unlocked: open, passed, passDays: days.size, attempts: (attempts[lv.id] || []).length };
      if (!passed) open = false;
    }
    return out;
  };
  /* Habilidades que fallaron, para no obligar a repetir todo el nivel. */
  X.corrective = function (results) {
    const map = { minSeconds: 'Hablar más tiempo: repite la práctica de 30, 45 y 60 segundos.', maxBlock: 'Bloqueos: practica las frases de rescate.', startWithin: 'Arranque: responde preguntas al azar empezando en menos de 3 segundos.', structure: 'Estructura: practica Punto-Razón-Ejemplo-Punto.', reason: 'Argumentar: di tres opiniones con "porque" y un ejemplo.', closing: 'Cierre: graba solo la última frase hasta que quede firme.', connectors: 'Conectores: repasa orden, causa, contraste y cierre.', maxFillersPerMin: 'Muletillas: reemplázalas por un silencio de un segundo.', minVariety: 'Vocabulario: usa tus palabras de repaso al hablar.', pitchVariation: 'Entonación: lee con diferentes emociones.', readingMatch: 'Lectura: repite el texto más despacio.', self: 'Revisa tu grabación con la lista de chequeo y repite.' };
    const seen = new Set(), out = [];
    for (const r of results) if (!r.ok && !seen.has(r.type)) { seen.add(r.type); out.push(map[r.type] || 'Repite esta práctica.'); }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
