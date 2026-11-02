/* Componente de grabación y evaluación. Es el mismo flujo en toda la app. */
(function (root) {
  const EP = root.EP, U = EP.ui, A = EP.analysis, P = EP.platform;

  U.analyze = async function (id, text, extra) {
    extra = extra || {};
    let audio = null;
    try {
      const buf = await P.getAudio(id), d = A.decodeWav(buf);
      await new Promise(r => setTimeout(r, 20));
      audio = A.audioMetrics(d.pcm, d.sampleRate);
    } catch (e) { audio = null; }
    const rep = A.report({ text, audio, words: extra.words, fillers: EP.state.profile.fillers, durationSec: extra.durationSec });
    if (extra.readingText) rep.reading = A.readingMatch(extra.readingText, text);
    return rep;
  };
  /* Guarda la toma. Si no es fiable, conserva el audio pero no entra en las tendencias. */
  U.saveTake = function (rec, opts) {
    const st = EP.state, item = { id: rec.id, title: opts.title || 'Práctica', kind: opts.kind || 'practica', at: Date.now(), text: rec.text || '', engine: rec.engine || '', prompt: opts.prompt || '', report: rec.report, group: opts.group || opts.prompt || opts.title };
    st.recordings.unshift(item);
    EP.touchDay(rec.report && rec.report.audio ? rec.report.audio.speakingSec : 0);
    EP.save();
    return item;
  };
  U.prevTake = (group, id) => EP.state.recordings.find(r => r.group === group && r.id !== id);

  U.playerHtml = (id, label) => `<button class="btn sm" data-play="${id}">${U.icon('play')}${U.h(label || 'Escuchar')}</button>`;
  let playing = null;
  U.wirePlayers = function (el) {
    el.querySelectorAll('[data-play]').forEach(b => {
      b.onclick = async () => {
        try {
          if (playing) { playing.pause(); playing = null; }
          const buf = await P.getAudio(b.dataset.play);
          const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
          playing = a; await a.play();
        } catch (e) { U.toast('No se pudo reproducir este audio.'); }
      };
    });
  };

  U.metricsHtml = function (r) {
    if (!r) return '';
    const m = [], a = r.audio, t = r.text;
    const row = (l, v, tag) => m.push(`<div class="metric"><span>${U.h(l)}</span><span class="row"><b>${U.h(v)}</b>${U.tag(tag)}</span></div>`);
    if (a) {
      row('Duración', U.fmtTime(a.durationSec), 'medido');
      row('Tiempo con voz', Math.round(a.speakingSec) + ' s', 'medido');
      row('Pausas de 0,3 s o más', `${a.pauseCount}, la mayor de ${a.longestPause.toFixed(1)} s`, 'medido');
      if (a.pitch) row('Variación de tono', a.pitch.variationSemis + ' semitonos', 'medido');
      if (a.intensity && !a.noisy) row('Rango de intensidad', a.intensity.rangeDb.toFixed(0) + ' dB', 'medido');
    }
    if (r.hasTranscript) {
      if (r.wpm) row('Palabras por minuto', r.wpm, 'estimado');
      row('Posibles muletillas', t.fillerTotal + (r.fillersPerMin != null ? ` (${r.fillersPerMin}/min)` : ''), 'estimado');
      row('Palabras vagas', t.vagueTotal, 'estimado');
      row('Conectores', `${t.connectorTotal} de ${t.connectorTypes} tipos`, 'estimado');
      row('Variedad de vocabulario', Math.round(t.variety * 100) + ' %', 'estimado');
      row('Estructura', r.structure.parts + ' de 3 partes', 'estimado');
      if (r.reading != null) row('Coincidencia con el texto', r.reading + ' %', 'estimado');
    }
    let warn = '';
    if (a && a.tooQuiet) warn = '<p class="tag bad">Muy poca voz en la toma</p>';
    else if (a && a.noisy) warn = '<p class="small" style="color:var(--warn)">Ruido alto. Esta toma no se usará en tus tendencias de voz.</p>';
    return `<div class="card"><h3 style="margin-top:0">Resultados</h3>${warn}${m.join('') || '<p class="muted">Sin datos medibles.</p>'}<p class="small muted">No es una calificación total: cada indicador se mira por separado.</p></div>`;
  };
  U.feedbackHtml = function (fb) {
    const li = a => a.map(x => `<li>${U.h(x)}</li>`).join('');
    return `<div class="card"><h3 style="margin-top:0">1. Lo que hiciste bien</h3><ul>${li(fb.good)}</ul>
      <h3>2. Lo que debes mejorar</h3><ul>${li(fb.improve)}</ul>
      <h3>3. Palabras que repetiste</h3><p class="muted">${fb.repeated.length ? U.h(fb.repeated.join(', ')) : 'Ninguna en exceso.'}</p>
      <h3>4. Expresiones que podrías usar</h3><ul>${li(fb.alternatives.slice(0, 4))}</ul>
      <h3>5. Cómo organizar mejor</h3><p>${U.h(fb.organize)}</p>
      <h3>6. Modelo de respuesta mejorada</h3><p class="quote">${U.h(fb.better)}</p>
      <h3>7. Ejercicio para corregir</h3><p>${U.h(fb.drill)}</p>
      <h3>8. Tu siguiente práctica</h3><p>${U.h(fb.next)}</p></div>`;
  };
  function compareHtml(prev, cur) {
    const a = prev.report, b = cur.report; if (!a || !b) return '';
    const v = (x, u) => x == null ? '-' : x + (u || '');
    const rows = [['Duración', v(a.audio && Math.round(a.audio.durationSec), ' s'), v(b.audio && Math.round(b.audio.durationSec), ' s')], ['Pausa mayor', v(a.audio && a.audio.longestPause, ' s'), v(b.audio && b.audio.longestPause, ' s')], ['Palabras/min', v(a.wpm), v(b.wpm)], ['Muletillas/min', v(a.fillersPerMin), v(b.fillersPerMin)], ['Estructura', v(a.structure && a.structure.parts, '/3'), v(b.structure && b.structure.parts, '/3')]];
    return `<div class="card"><h3 style="margin-top:0">Comparación con tu toma anterior</h3>${rows.map(r => `<div class="metric"><span>${r[0]}</span><span>${r[1]} → <b>${r[2]}</b></span></div>`).join('')}<div class="row" style="margin-top:8px">${U.playerHtml(prev.id, 'Anterior')}${U.playerHtml(cur.id, 'Esta toma')}</div></div>`;
  }
  /* Palabras del banco detectadas, para confirmar el uso. */
  function detected(text) {
    if (!text) return [];
    const c = EP.state.cards;
    return Object.keys(c).filter(w => c[w].state >= 1 && A.usesWord(text, w)).slice(0, 8);
  }

  /* opts: prompt, title, kind, sec, group, readingText, targetWord, noFeedback, onDone(item, report), doneLabel, hideModel */
  U.recorder = function (host, opts) {
    let running = false, t0 = 0, iv = null, id = null, stopping = false;
    const target = opts.sec || 0;
    const stage = () => {
      host.innerHTML = `<div class="card" style="text-align:center">
        <div class="timer" id="recTimer">${target ? U.fmtTime(target) : '00:00'}</div>
        <div class="muted small" id="recHint">${target ? 'Meta: ' + U.fmtTime(target) + '. Puedes detenerte antes.' : 'Graba cuando quieras.'}</div>
        <button class="mic" id="recBtn" aria-label="Comenzar grabación">${U.icon('mic')}</button>
        <div class="small muted" id="recLabel">Comenzar</div>
        <div class="live" id="recLive" style="display:none"></div>
        <button class="btn ghost sm" id="typeBtn" style="margin-top:8px">No puedo hablar ahora: responder por escrito</button></div>`;
      host.querySelector('#recBtn').onclick = toggle;
      host.querySelector('#typeBtn').onclick = typed;
    };
    /* Práctica sin voz: útil en la calle. Evalúa estructura y palabras, nunca la voz. */
    function typed() {
      host.innerHTML = `<div class="card"><label for="wr" style="margin-top:0">Tu respuesta por escrito</label><textarea id="wr"></textarea><p class="small muted">Esto no mide tu voz ni cuenta para tus tendencias de voz.</p><div class="row"><button class="btn grow" id="wrBack">Volver a grabar</button><button class="btn primary grow" id="wrOk">Evaluar</button></div></div>`;
      host.querySelector('#wrBack').onclick = stage;
      host.querySelector('#wrOk').onclick = async () => {
        const text = host.querySelector('#wr').value.trim();
        if (!text) return U.toast('Escribe tu respuesta.');
        await results({ id: U.uid(), text, engine: 'Escrito', noAudio: true });
      };
    }
    async function toggle() { if (stopping) return; running ? await stop() : await start(); }
    async function start() {
      P.stopSpeak();
      const ok = await P.requestMic();
      if (!ok) { U.toast('Sin permiso de micrófono no se puede grabar. Puedes activarlo en los ajustes del teléfono.'); return; }
      id = U.uid();
      const live = host.querySelector('#recLive');
      try {
        await P.start(id, txt => { live.style.display = 'block'; live.textContent = txt; });
      } catch (e) { U.toast('No se pudo iniciar la grabación: ' + e.message); return; }
      running = true; t0 = Date.now();
      host.querySelector('#recBtn').classList.add('rec'); host.querySelector('#recBtn').innerHTML = U.icon('stop');
      host.querySelector('#recLabel').textContent = 'Detener'; host.querySelector('#recBtn').setAttribute('aria-label', 'Detener grabación');
      iv = setInterval(() => {
        const s = (Date.now() - t0) / 1000, el = host.querySelector('#recTimer');
        if (!el) return clearInterval(iv);
        el.textContent = target ? U.fmtTime(target - s) : U.fmtTime(s);
        if (target && s >= target) { el.style.color = 'var(--gold)'; el.textContent = '+' + U.fmtTime(s - target); }
      }, 250);
      U.onLeave(() => { clearInterval(iv); if (running) { running = false; P.stop().catch(() => {}); } });
    }
    async function stop() {
      stopping = true; clearInterval(iv); running = false;
      const label = host.querySelector('#recLabel'); if (label) label.textContent = 'Analizando...';
      let rec;
      try { rec = await P.stop(); } catch (e) { U.toast('No se pudo terminar la grabación.'); stopping = false; stage(); return; }
      U.onLeave(null);
      rec.id = rec.id || id;
      await results(rec);
      stopping = false;
    }
    async function results(rec) {
      rec.report = await U.analyze(rec.id, rec.text || '', { words: rec.words, durationSec: rec.durationSec, readingText: opts.readingText });
      const item = U.saveTake(rec, opts);
      if (rec.noAudio) item.deleted = item.noAudio = true;
      const prev = U.prevTake(item.group, item.id);
      if (opts.targetWord && EP.state.cards[opts.targetWord] && A.usesWord(rec.text || '', opts.targetWord)) {
        EP.state.cards[opts.targetWord] = EP.srs.markGuided(EP.state.cards[opts.targetWord], Date.now());
      }
      render(item, prev);
      if (opts.onTake) opts.onTake(item);
    }
    function render(item, prev) {
      const r = item.report, ctx = { targetSec: target, prompt: opts.prompt };
      const fb = A.feedback(r, ctx);
      const found = detected(item.text).filter(w => w !== opts.targetWord);
      host.innerHTML = `<div class="card"><div class="row between"><h3 style="margin:0">Tu toma</h3>${item.noAudio ? '<span class="tag">Sin audio</span>' : U.playerHtml(item.id)}</div>
        <label for="txt">Transcripción ${item.engine ? `<span class="muted small">(${U.h(item.engine)})</span>` : ''}</label>
        <textarea id="txt" placeholder="${P.canTranscribe() ? 'No se detectó texto. Escribe lo que dijiste.' : 'Este navegador no transcribe. Escribe lo que dijiste para evaluar palabras y estructura.'}">${U.h(item.text)}</textarea>
        <p class="small muted">Si el transcriptor falló, corrígelo: no se te penaliza por sus errores.</p>
        <button class="btn sm" id="recalc">Recalcular con este texto</button></div>
        ${found.length ? `<div class="card"><h3 style="margin-top:0">¿Usaste bien estas palabras?</h3><p class="small muted">Las detecté en tu texto. Confírmalas solo si las usaste con sentido.</p><div class="row">${found.map(w => `<button class="chip" data-word="${U.h(w)}">${U.h(w)}</button>`).join('')}</div></div>` : ''}
        ${U.metricsHtml(r)}
        ${opts.noFeedback ? '' : U.feedbackHtml(fb)}
        ${prev ? compareHtml(prev, item) : ''}
        <div class="row" style="margin:12px 0"><button class="btn grow" id="again">Repetir y mejorar</button>${opts.onDone ? `<button class="btn primary grow" id="doneBtn">${U.h(opts.doneLabel || 'Continuar')}</button>` : ''}</div>`;
      U.wirePlayers(host);
      host.querySelector('#again').onclick = () => { stage(); window.scrollTo(0, 0); };
      if (opts.onDone) host.querySelector('#doneBtn').onclick = () => opts.onDone(item, r);
      host.querySelector('#recalc').onclick = async () => {
        item.text = host.querySelector('#txt').value.trim();
        item.report = await U.analyze(item.id, item.text, { readingText: opts.readingText, durationSec: r.audio && r.audio.durationSec });
        EP.save(); U.toast('Evaluación actualizada.'); render(item, prev);
      };
      host.querySelectorAll('[data-word]').forEach(b => {
        b.onclick = () => {
          const w = b.dataset.word; EP.state.cards[w] = EP.srs.markSpontaneous(EP.state.cards[w], Date.now());
          b.classList.add('on'); b.disabled = true; EP.save(); U.toast('Uso registrado: ' + w);
        };
      });
      window.scrollTo(0, 0);
    }
    stage();
  };
})(typeof window !== 'undefined' ? window : globalThis);
