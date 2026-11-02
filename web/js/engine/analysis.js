/* ELOQUENT PRO - motor de análisis. Todo es local y determinista.
   Cada métrica lleva etiqueta: medido, estimado o autoevaluacion. */
(function (root) {
  const EP = root.EP = root.EP || {};
  const A = EP.analysis = {};

  A.FILLERS = ['o sea', 'pues', 'este', 'eh', 'em', 'mm', 'digamos', 'como que', 'entonces', 'sí o no', 'me entiendes', 'cierto', 'bueno', 'tipo', 'osea', 'vea', 'ajá'];
  A.VAGUE = ['cosa', 'cosas', 'algo', 'eso', 'esto', 'tema', 'temas', 'etcétera', 'etc', 'bastante', 'tal', 'coso', 'vaina', 'vainas'];
  A.CONNECTORS = {
    orden: ['primero', 'segundo', 'tercero', 'después', 'luego', 'finalmente', 'por último', 'para empezar', 'para terminar'],
    causa: ['porque', 'ya que', 'debido a', 'puesto que', 'gracias a'],
    consecuencia: ['por eso', 'por lo tanto', 'así que', 'en consecuencia', 'de modo que'],
    contraste: ['pero', 'sin embargo', 'aunque', 'en cambio', 'no obstante'],
    ejemplo: ['por ejemplo', 'es decir', 'como cuando', 'en otras palabras'],
    cierre: ['en conclusión', 'en resumen', 'para concluir', 'para cerrar', 'en síntesis', 'en definitiva']
  };
  const STOP = new Set('a al algo ante como con de del desde donde el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los más me mi mis muy no nos o para pero por que qué se si sí sin sobre son su sus te tiene tu un una uno unos unas y ya yo'.split(' '));

  A.normalize = function (t) {
    return String(t || '').toLowerCase().replace(/[¿?¡!.,;:"“”()\[\]…]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  A.tokens = function (t) { const n = A.normalize(t); return n ? n.split(' ') : []; };
  function countPhrase(norm, phrase) {
    const re = new RegExp('(^| )' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?= |$)', 'g');
    return (norm.match(re) || []).length;
  }
  A.countPhrase = countPhrase;

  /* ---------- Señal de audio ---------- */
  A.frameRms = function (pcm, sampleRate, frameMs) {
    const size = Math.max(1, Math.round(sampleRate * (frameMs || 20) / 1000));
    const n = Math.floor(pcm.length / size), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < size; j++) { const v = pcm[i * size + j]; s += v * v; }
      out[i] = Math.sqrt(s / size);
    }
    return out;
  };
  function percentile(arr, p) {
    if (!arr.length) return 0;
    const a = Array.from(arr).sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.floor(p * a.length))];
  }
  A.percentile = percentile;
  const db = v => 20 * Math.log10(Math.max(v, 1e-6));

  /* Detector de voz por energía con piso de ruido adaptativo. */
  A.voiceActivity = function (rms, frameMs) {
    const noise = percentile(rms, 0.05), loud = percentile(rms, 0.95);
    const snrDb = db(loud) - db(noise);
    const thr = Math.max(0.006, noise + (loud - noise) * 0.14);
    const speech = new Uint8Array(rms.length);
    for (let i = 0; i < rms.length; i++) speech[i] = rms[i] > thr ? 1 : 0;
    const hang = Math.round(150 / frameMs);   // puentea cortes menores a 150 ms
    let gap = 0;
    for (let i = 0; i < speech.length; i++) {
      if (speech[i]) { if (gap > 0 && gap <= hang) for (let j = i - gap; j < i; j++) speech[j] = 1; gap = 0; }
      else gap++;
    }
    return { speech, thr, noise, loud, snrDb };
  };

  /* Pausas: silencios de 300 ms o más entre el inicio y el fin del habla. */
  A.pauses = function (speech, frameMs) {
    let first = -1, last = -1;
    for (let i = 0; i < speech.length; i++) if (speech[i]) { if (first < 0) first = i; last = i; }
    const out = [];
    if (first < 0) return { list: [], first: -1, last: -1 };
    let start = -1;
    for (let i = first; i <= last; i++) {
      if (!speech[i]) { if (start < 0) start = i; }
      else if (start >= 0) {
        const ms = (i - start) * frameMs;
        if (ms >= 300) out.push({ at: start * frameMs / 1000, sec: ms / 1000 });
        start = -1;
      }
    }
    return { list: out, first: first * frameMs / 1000, last: (last + 1) * frameMs / 1000 };
  };

  /* Tono por autocorrelación normalizada: 70-400 Hz. */
  A.pitchTrack = function (pcm, sampleRate, speech, frameMs) {
    const hopMs = 40, hop = Math.round(sampleRate * hopMs / 1000), win = Math.round(sampleRate * 0.04);
    const minLag = Math.floor(sampleRate / 400), maxLag = Math.ceil(sampleRate / 70);
    const track = [], r = new Float32Array(maxLag + 1);
    for (let f = 0; f * hop + win + maxLag + 1 < pcm.length; f++) {
      const sf = speech ? speech[Math.floor(f * hopMs / (frameMs || 20))] : 1;
      if (!sf) { track.push(0); continue; }
      const off = f * hop;
      let e0 = 0, e1 = 0, best = 0;
      for (let i = 0; i < win; i++) { e0 += pcm[off + i] * pcm[off + i]; e1 += pcm[off + minLag + i] * pcm[off + minLag + i]; }
      if (e0 < 1e-5) { track.push(0); continue; }
      for (let lag = minLag; lag <= maxLag; lag++) {
        let c = 0;
        for (let i = 0; i < win; i++) c += pcm[off + i] * pcm[off + lag + i];
        r[lag] = c / Math.sqrt(e0 * e1 + 1e-9);
        if (r[lag] > best) best = r[lag];
        e1 += pcm[off + lag + win] * pcm[off + lag + win] - pcm[off + lag] * pcm[off + lag];
      }
      if (best < 0.5) { track.push(0); continue; }
      /* Primer pico fuerte: evita confundir el tono con su octava inferior. */
      let bestLag = 0;
      for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (r[lag] >= 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { bestLag = lag; break; }
      }
      track.push(bestLag ? sampleRate / bestLag : 0);
    }
    return track;
  };
  /* Curva en semitonos respecto a la mediana: permite comparar voces distintas. */
  A.contour = function (track) {
    const v = track.filter(x => x > 0);
    if (v.length < 5) return [];
    const med = percentile(v, 0.5);
    return v.map(x => 12 * Math.log2(x / med));
  };
  A.resample = function (arr, n) {
    if (!arr.length) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * arr.length / n)]);
    return out;
  };
  /* Parecido de curvas 0-100 mediante alineación DTW. No mide "acento correcto". */
  A.contourSimilarity = function (a, b) {
    if (a.length < 5 || b.length < 5) return null;
    const x = A.resample(a, 80), y = A.resample(b, 80), n = 80, band = 16, INF = 1e9;
    let prev = new Float64Array(n + 1).fill(INF); prev[0] = 0;
    for (let i = 1; i <= n; i++) {
      const cur = new Float64Array(n + 1).fill(INF);
      for (let j = Math.max(1, i - band); j <= Math.min(n, i + band); j++) {
        cur[j] = Math.abs(x[i - 1] - y[j - 1]) + Math.min(prev[j], prev[j - 1], cur[j - 1]);
      }
      prev = cur;
    }
    const mean = prev[n] / (2 * n);
    return Math.max(0, Math.round(100 * (1 - mean / 5)));
  };

  A.audioMetrics = function (pcm, sampleRate) {
    const frameMs = 20, rms = A.frameRms(pcm, sampleRate, frameMs);
    const durationSec = pcm.length / sampleRate;
    if (!rms.length) return { durationSec, speakingSec: 0, snrDb: 0, noisy: true, pauses: [], longestPause: 0, pauseCount: 0, pitch: null, intensity: null, tooQuiet: true };
    const vad = A.voiceActivity(rms, frameMs), p = A.pauses(vad.speech, frameMs);
    let speechFrames = 0; for (const s of vad.speech) speechFrames += s;
    const speakingSec = speechFrames * frameMs / 1000;
    const speechRms = []; rms.forEach((v, i) => { if (vad.speech[i]) speechRms.push(v); });
    const noisy = vad.snrDb < 15 || db(vad.noise) > -35;
    const tooQuiet = db(vad.loud) < -38 || speakingSec < 0.5;
    let pitch = null;
    if (!noisy && !tooQuiet) {
      const track = A.pitchTrack(pcm, sampleRate, vad.speech, frameMs), voiced = track.filter(x => x > 0);
      if (voiced.length > 10) {
        const c = A.contour(track), med = percentile(voiced, 0.5);
        const mean = c.reduce((s, v) => s + v, 0) / c.length;
        const sd = Math.sqrt(c.reduce((s, v) => s + (v - mean) * (v - mean), 0) / c.length);
        pitch = { medianHz: Math.round(med), rangeSemis: +(percentile(c, 0.95) - percentile(c, 0.05)).toFixed(1), variationSemis: +sd.toFixed(1), contour: A.resample(c, 120).map(v => +v.toFixed(2)) };
      }
    }
    const longest = p.list.reduce((m, x) => Math.max(m, x.sec), 0);
    return {
      durationSec: +durationSec.toFixed(2), speakingSec: +speakingSec.toFixed(2),
      firstSpeechSec: +(p.first < 0 ? durationSec : p.first).toFixed(2),
      snrDb: +vad.snrDb.toFixed(1), noisy, tooQuiet,
      pauses: p.list.map(x => ({ at: +x.at.toFixed(2), sec: +x.sec.toFixed(2) })),
      pauseCount: p.list.length, longestPause: +longest.toFixed(2),
      pauseTotal: +p.list.reduce((m, x) => m + x.sec, 0).toFixed(2),
      intensity: speechRms.length ? { meanDb: +db(speechRms.reduce((s, v) => s + v, 0) / speechRms.length).toFixed(1), rangeDb: +(db(percentile(speechRms, 0.95)) - db(percentile(speechRms, 0.1))).toFixed(1) } : null,
      pitch
    };
  };

  /* ---------- Texto ---------- */
  A.textMetrics = function (text, opts) {
    opts = opts || {};
    const toks = A.tokens(text), norm = toks.join(' '), n = toks.length;
    const fillersList = opts.fillers || A.FILLERS, fillers = {};
    let fillerTotal = 0;
    for (const f of fillersList) { const c = countPhrase(norm, f); if (c) { fillers[f] = c; fillerTotal += c; } }
    const vague = {}; let vagueTotal = 0;
    for (const f of A.VAGUE) { const c = countPhrase(norm, f); if (c) { vague[f] = c; vagueTotal += c; } }
    const connectors = {}; let connectorTotal = 0, connectorTypes = 0;
    for (const k in A.CONNECTORS) {
      let t = 0; for (const c of A.CONNECTORS[k]) t += countPhrase(norm, c);
      if (t) { connectors[k] = t; connectorTotal += t; connectorTypes++; }
    }
    const freq = {};
    for (const t of toks) if (!STOP.has(t) && t.length > 2) freq[t] = (freq[t] || 0) + 1;
    const limit = Math.max(3, Math.ceil(n / 40));
    const repeated = Object.keys(freq).filter(k => freq[k] >= limit && !fillersList.includes(k)).sort((a, b) => freq[b] - freq[a]).slice(0, 6).map(k => ({ word: k, count: freq[k] }));
    let immediate = 0;
    for (let i = 1; i < n; i++) if (toks[i] === toks[i - 1] && toks[i].length > 1) immediate++;
    const content = toks.filter(t => !STOP.has(t));
    const variety = content.length ? new Set(content).size / content.length : 0;
    const qs = (String(text).match(/\?/g) || []).length;
    return { words: n, fillers, fillerTotal, vague, vagueTotal, connectors, connectorTotal, connectorTypes, repeated, immediateRepeats: immediate, variety: +variety.toFixed(2), questions: qs };
  };

  /* Estructura estimada: busca inicio claro, razón o ejemplo y cierre. */
  A.structure = function (text, durationSec) {
    const t = A.textMetrics(text), norm = A.tokens(text).join(' ');
    const third = Math.floor(A.tokens(text).length * 0.7), tail = A.tokens(text).slice(third).join(' ');
    const reason = !!(t.connectors.causa || t.connectors.consecuencia);
    const example = !!t.connectors.ejemplo || /\b(una vez|recuerdo|cuando yo|me pasó)\b/.test(norm);
    const hasOrder = !!t.connectors.orden;
    const closing = A.CONNECTORS.cierre.some(c => countPhrase(tail, c)) || /\b(por eso|por último|finalmente|así que|gracias|mi conclusión)\b/.test(tail);
    const opening = t.words >= 5 && !A.FILLERS.includes(A.tokens(text)[0]);
    return { opening, reason, example, hasOrder, closing, parts: [opening, reason || example, closing].filter(Boolean).length };
  };

  /* Forma básica para reconocer palabras conjugadas. */
  A.stem = function (w) {
    w = A.normalize(w).normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (w.length <= 4) return w;
    const suf = ['aciones','iciones','amente','mente','aremos','iremos','ando','iendo','ación','acion','adas','ados','idas','idos','aron','ieron','amos','imos','aban','ada','ado','ida','ido','ar','er','ir','as','es','os','an','en','a','e','o','s'];
    for (const s of suf) if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length);
    return w;
  };
  const plain = w => A.normalize(w).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /* Raíces de un verbo con sus cambios comunes: recomendar/recomiendo, proponer/propuse. */
  A.verbRoots = function (inf) {
    const w = plain(inf), out = new Set();
    if (!/(ar|er|ir)$/.test(w) || w.length < 5) return null;
    const base = w.slice(0, -2);
    out.add(base);
    for (const [end, alts] of [['poner', ['pon', 'pong', 'pus']], ['tener', ['ten', 'teng', 'tuv', 'tien']], ['ducir', ['duc', 'duzc', 'duj']], ['facer', ['fac', 'fag', 'fiz', 'fic']], ['ver', ['ve', 'vi']], ['venir', ['ven', 'veng', 'vin', 'vien']]]) {
      if (w.endsWith(end)) alts.forEach(x => out.add(w.slice(0, -end.length) + x));
    }
    const i = Math.max(base.lastIndexOf('e'), base.lastIndexOf('o'), base.lastIndexOf('u'));
    if (i > 0) {
      const pre = base.slice(0, i), post = base.slice(i + 1), v = base[i];
      const alts = v === 'e' ? ['ie', 'i'] : v === 'o' ? ['ue', 'u'] : v === 'u' ? ['ue'] : [];
      alts.forEach(x => out.add(pre + x + post));
    }
    for (const r of Array.from(out)) {
      if (r.endsWith('z')) out.add(r.slice(0, -1) + 'c');
      if (r.endsWith('c')) { out.add(r.slice(0, -1) + 'qu'); out.add(r.slice(0, -1) + 'zc'); out.add(r.slice(0, -1) + 'z'); out.add(r.slice(0, -1) + 'j'); }
      if (r.endsWith('g')) { out.add(r + 'u'); out.add(r.slice(0, -1) + 'j'); }
      if (r.endsWith('u')) out.add(r + 'y');
    }
    return Array.from(out).filter(r => r.length >= 3);
  };
  A.usesWord = function (text, word) {
    if (word.includes(' ')) return A.normalize(text).includes(A.normalize(word));
    const toks = A.tokens(text).map(plain), roots = A.verbRoots(word);
    if (roots && toks.some(t => roots.some(r => t.startsWith(r)))) return true;
    const tgt = A.stem(word);
    return toks.some(t => A.stem(t) === tgt);
  };

  /* Une transcripción y audio en un informe con etiquetas claras. */
  A.report = function (input) {
    const audio = input.audio || null, text = input.text || '', tm = A.textMetrics(text, { fillers: input.fillers });
    const words = input.words || null;
    let wpm = null;
    if (audio && tm.words >= 5 && audio.speakingSec > 1) wpm = Math.round(tm.words / ((audio.speakingSec + (audio.pauseTotal || 0)) / 60));
    else if (words && words.length > 5) { const d = words[words.length - 1].end - words[0].start; if (d > 1) wpm = Math.round(words.length / (d / 60)); }
    const durMin = (audio ? audio.durationSec : (input.durationSec || 0)) / 60;
    return {
      at: input.at || Date.now(), hasTranscript: tm.words > 0, audio, text: tm, wpm,
      fillersPerMin: durMin > 0 && tm.words ? +(tm.fillerTotal / durMin).toFixed(1) : null,
      structure: A.structure(text),
      reliable: !!audio && !audio.noisy && !audio.tooQuiet
    };
  };

  /* Retroalimentación en ocho partes, a partir de datos reales. */
  A.feedback = function (r, ctx) {
    ctx = ctx || {};
    const good = [], improve = [], tm = r.text, st = r.structure, a = r.audio;
    const fb = { good, improve, repeated: [], alternatives: [], organize: '', better: '', drill: '', next: '' };
    if (!r.hasTranscript) {
      improve.push('No hay transcripción: escribe lo que dijiste o usa la app instalada para evaluar palabras y estructura.');
    }
    if (a) {
      if (a.tooQuiet) improve.push('La grabación tiene muy poca voz. Acerca el teléfono y repite.');
      else if (a.noisy) improve.push('Hay ruido alto: no guardé métricas de voz en tu historial para no falsear tu progreso.');
      if (ctx.targetSec) {
        if (a.durationSec >= ctx.targetSec * 0.9) good.push(`Sostuviste la intervención ${Math.round(a.durationSec)} s de los ${ctx.targetSec} s propuestos.`);
        else improve.push(`Terminaste en ${Math.round(a.durationSec)} s; la meta era ${ctx.targetSec} s. Antes de cerrar, agrega un ejemplo.`);
      }
      if (a.longestPause > 5) improve.push(`Tu pausa más larga fue de ${a.longestPause.toFixed(1)} s. Si te bloqueas, usa una frase de rescate como "lo diría de otra manera".`);
      else if (a.pauseCount >= 2 && a.longestPause <= 2) good.push('Tus pausas fueron breves. Una pausa bien puesta también comunica.');
      if (a.pitch && !a.noisy && a.pitch.variationSemis < 1.5) improve.push('Tu tono varió poco en esta toma. Prueba a subir el énfasis en la palabra más importante de cada frase.');
    }
    if (r.hasTranscript) {
      if (r.wpm && r.wpm > 190) improve.push(`Hablaste a unas ${r.wpm} palabras por minuto (estimado). Haz una pausa al terminar cada idea.`);
      if (r.wpm && r.wpm < 90) improve.push(`Hablaste a unas ${r.wpm} palabras por minuto (estimado). Si buscabas palabras, prepara tres puntos antes de empezar.`);
      if (tm.fillerTotal) {
        const top = Object.keys(tm.fillers).sort((x, y) => tm.fillers[y] - tm.fillers[x])[0];
        if ((r.fillersPerMin || 0) > 4) improve.push(`Posibles muletillas: ${tm.fillerTotal}, sobre todo "${top}". Cámbialas por un silencio breve.`);
      } else if (tm.words > 20) good.push('No detecté muletillas de la lista. El transcriptor puede omitir algunas: escúchate para confirmarlo.');
      if (st.parts === 3) good.push('Se distingue un inicio, un desarrollo con razón o ejemplo y un cierre.');
      if (!st.reason && !st.example) improve.push('Dijiste la idea sin apoyarla. Añade "porque" y un ejemplo concreto.');
      if (!st.closing) improve.push('Faltó un cierre claro. Termina con "por eso" o repitiendo tu idea central.');
      if (tm.connectorTypes >= 3) good.push(`Usaste ${tm.connectorTypes} tipos de conectores, lo que ayuda a seguirte.`);
      if (tm.vagueTotal >= 3) improve.push(`Usaste ${tm.vagueTotal} palabras vagas (${Object.keys(tm.vague).slice(0, 3).join(', ')}). Nombra exactamente a qué te refieres.`);
      fb.repeated = tm.repeated.map(x => `${x.word} (${x.count})`);
    }
    if (!good.length) good.push('Lo intentaste y ya tienes una toma real para comparar. Esa es tu base.');
    if (!improve.length) improve.push('Sube la dificultad: repite con una pregunta inesperada o un minuto más.');
    const alt = { 'cosa': 'aspecto, factor, detalle', 'cosas': 'aspectos, factores, detalles', 'algo': 'un resultado, una condición', 'bastante': 'un 30 %, varias veces (dilo con dato)', 'tema': 'asunto, punto, problema', 'bueno': 'silencio breve', 'pues': 'silencio breve', 'o sea': 'es decir, en otras palabras', 'entonces': 'por eso, en consecuencia', 'este': 'silencio breve', 'tipo': 'por ejemplo', 'como que': 'parece que, considero que' };
    for (const k of Object.keys(tm.fillers || {}).concat(Object.keys(tm.vague || {}))) if (alt[k]) fb.alternatives.push(`En lugar de "${k}": ${alt[k]}.`);
    if (!fb.alternatives.length) fb.alternatives.push('Prueba con un verbo más preciso: analizar, proponer, comprobar, resolver.');
    fb.organize = st.parts < 3 ? 'Usa Punto-Razón-Ejemplo-Punto: di tu idea, explica por qué, da un caso real y repite la idea.' : 'Mantén tu estructura y agrega un dato o un caso concreto para hacerla más sólida.';
    const q = ctx.prompt ? `Sobre "${ctx.prompt}": ` : '';
    fb.better = q + 'Mi punto es este: [tu idea en una frase]. Lo digo porque [razón]. Por ejemplo, [caso real con un dato]. Por eso, [repite tu idea y qué esperas que pase].';
    fb.drill = improve.some(s => /muletillas/.test(s)) ? 'Habla 30 segundos y, cada vez que sientas venir una muletilla, cállate un segundo. Repite tres veces.'
      : improve.some(s => /cierre/.test(s)) ? 'Toma esta misma respuesta y graba solo las dos últimas frases hasta que el cierre quede firme.'
      : improve.some(s => /porque/.test(s)) ? 'Di tres opiniones seguidas, cada una con "porque" y un ejemplo.'
      : 'Repite la misma respuesta ahora, con una sola mejora, y compara ambas tomas.';
    fb.next = ctx.next || 'Usa el botón Repetir y mejorar. Después sigue con un tema un poco más difícil.';
    return fb;
  };

  /* Compara lo leído con el texto objetivo. Sirve para lectura y laboratorio. */
  A.readingMatch = function (target, said) {
    const a = A.tokens(target), b = A.tokens(said);
    if (!a.length || !b.length) return null;
    const m = a.length, n = b.length;
    let prev = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      const cur = new Array(n + 1).fill(0);
      for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      prev = cur;
    }
    return Math.round(100 * prev[n] / m);
  };

  /* Decodifica WAV PCM de 16 bits a Float32. */
  A.decodeWav = function (buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0) !== 0x52494646) throw new Error('No es un WAV');
    let p = 12, rate = 16000, ch = 1, bits = 16, dataOff = 0, dataLen = 0;
    while (p + 8 <= buf.byteLength) {
      const id = dv.getUint32(p), len = dv.getUint32(p + 4, true);
      if (id === 0x666d7420) { ch = dv.getUint16(p + 10, true); rate = dv.getUint32(p + 12, true); bits = dv.getUint16(p + 22, true); }
      if (id === 0x64617461) { dataOff = p + 8; dataLen = Math.min(len, buf.byteLength - dataOff); break; }
      p += 8 + len + (len % 2);
    }
    if (bits !== 16) throw new Error('Solo se admite PCM de 16 bits');
    const count = Math.floor(dataLen / 2 / ch), out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = dv.getInt16(dataOff + i * 2 * ch, true) / 32768;
    return { pcm: out, sampleRate: rate };
  };
  A.encodeWav = function (pcm, rate) {
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
    return buf;
  };
})(typeof window !== 'undefined' ? window : globalThis);
