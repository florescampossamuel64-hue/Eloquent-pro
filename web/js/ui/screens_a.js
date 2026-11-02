(function (root) {
  const EP = root.EP, U = EP.ui, h = U.h, S = EP.srs, A = EP.analysis, P = EP.platform;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  U.pick = pick;

  /* ---------- Bienvenida y configuración ---------- */
  U.route('welcome', () => U.view('', `<div class="hero" style="margin-top:24px"><div class="logo">ELOQUENT PRO<small>ACADEMIA DE COMUNICACIÓN</small></div>
      <p style="margin-top:14px">Tu entrenador personal para pensar con claridad, encontrar las palabras, hablar con seguridad y negociar.</p></div>
    <div class="card"><h3 style="margin-top:0">Cómo funciona</h3>
      <p>1. Un diagnóstico para saber desde dónde empiezas.</p><p>2. Ocho niveles que se aprueban demostrando la habilidad.</p><p>3. Práctica con tu voz y correcciones concretas.</p></div>
    <div class="card"><h3 style="margin-top:0">Tu privacidad</h3><p class="muted">Tus grabaciones se quedan en este teléfono. No se suben a ningún servidor ni se usan para entrenar modelos.</p></div>
    <button class="btn primary block" data-go="setup">Empezar</button>${U.brand()}`));

  const GOALS = ['Hablar en público', 'Conversar con seguridad', 'Ampliar mi vocabulario', 'Vender y negociar', 'Mejorar mi voz', 'Hablar mejor en mis videos'];
  U.route('setup', () => {
    const p = EP.state.profile;
    U.view('Configuración inicial', `<label for="n">¿Cómo te llamas?</label><input id="n" value="${h(p.name)}" autocomplete="name">
      <label>¿Qué quieres mejorar primero?</label><div class="row">${GOALS.map(g => `<button class="chip ${p.goals.includes(g) ? 'on' : ''}" data-g="${h(g)}">${h(g)}</button>`).join('')}</div>
      <label>¿Cuánto tiempo practicarás al día?</label><div class="row">${[3, 5, 10, 20].map(m => `<button class="chip ${p.minutes === m ? 'on' : ''}" data-m="${m}">${m} min</button>`).join('')}</div>
      <label class="check" style="margin-top:14px"><input type="checkbox" id="rem" ${p.reminder.on ? 'checked' : ''}><span>Recordarme practicar cada día</span></label>
      <input type="time" id="remT" value="${String(p.reminder.h).padStart(2, '0')}:${String(p.reminder.m).padStart(2, '0')}">
      <div class="card"><h3 style="margin-top:0">Micrófono</h3><p class="muted">Lo usamos solo cuando tocas grabar, para evaluar tu práctica aquí en el teléfono.</p><button class="btn sm" id="mic">Permitir micrófono</button> <span id="micS" class="small"></span></div>
      <button class="btn primary block" id="ok">Continuar al diagnóstico</button>`, () => {
      U.$$('[data-g]').forEach(b => b.onclick = () => { const g = b.dataset.g, i = p.goals.indexOf(g); i < 0 ? p.goals.push(g) : p.goals.splice(i, 1); b.classList.toggle('on'); });
      U.$$('[data-m]').forEach(b => b.onclick = () => { p.minutes = +b.dataset.m; U.$$('[data-m]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      U.$('#mic').onclick = async () => { const ok = await P.requestMic(); U.$('#micS').textContent = ok ? 'Permitido' : 'No permitido: podrás activarlo después.'; };
      U.$('#ok').onclick = () => {
        p.name = U.$('#n').value.trim();
        if (!p.name) return U.toast('Escribe tu nombre para continuar.');
        const [hh, mm] = U.$('#remT').value.split(':').map(Number);
        p.reminder = { on: U.$('#rem').checked, h: hh || 0, m: mm || 0 };
        if (p.reminder.on && !P.reminder(true, p.reminder.h, p.reminder.m)) U.toast('Los recordatorios funcionan en la app instalada.');
        EP.state.onboarded = true; EP.save(true); U.go('diagnostic', null, true);
      };
    });
  });

  /* ---------- Diagnóstico inicial ---------- */
  U.route('diagnostic', () => {
    const d = EP.state.diagnostic, steps = EP.DIAGNOSTIC;
    if (d.done) return U.go('diagReport', null, true);
    const st = steps[d.step];
    if (!st) { d.report = buildDiag(); d.done = true; d.at = Date.now(); EP.save(true); return U.go('diagReport', null, true); }
    const head = `<p class="muted small">Prueba ${d.step + 1} de ${steps.length}</p><div class="progress"><i style="width:${100 * d.step / steps.length}%"></i></div><h2>${h(st.title)}</h2>`;
    const next = (res) => { d.results[st.id] = res; d.step++; EP.save(true); U.go('diagnostic', null, true); };
    const skip = `<button class="btn ghost block" id="later">Seguir más tarde</button>`;
    if (st.kind === 'vocab') {
      let i = 0, score = 0;
      const q = () => {
        const it = EP.VOCAB_QUIZ[i];
        if (!it) return next({ correct: score, total: EP.VOCAB_QUIZ.length });
        U.view('Diagnóstico', head + `<div class="card"><p>${h(it.q)}</p>${it.o.map(o => `<button class="btn block" data-o="${h(o)}">${h(o)}</button>`).join('')}</div><p class="muted small">Pregunta ${i + 1} de ${EP.VOCAB_QUIZ.length}</p>`, () => {
          U.$$('[data-o]').forEach(b => b.onclick = () => { if (b.dataset.o === it.a) score++; i++; q(); });
        });
      };
      return q();
    }
    if (st.kind === 'build') {
      let i = 0, ok = 0;
      const q = () => {
        const it = EP.SENTENCE_BUILD[i];
        if (!it) return next({ correct: ok, total: EP.SENTENCE_BUILD.length });
        const sh = it.parts.slice().sort(() => Math.random() - 0.5);
        U.view('Diagnóstico', head + `<div class="card"><p>Toca las partes en orden para armar una frase con sentido.</p><div class="quote" id="out" style="min-height:44px"></div><div class="row">${sh.map((x, k) => `<button class="chip" data-k="${k}">${h(x)}</button>`).join('')}</div><div class="row" style="margin-top:10px"><button class="btn sm ghost" id="clr">Borrar</button></div></div>`, () => {
          let out = [];
          U.$$('[data-k]').forEach(b => b.onclick = () => {
            out.push(b.textContent); b.disabled = true; U.$('#out').textContent = out.join(' ');
            if (out.length === sh.length) { if (out.join(' ') === it.a) ok++; i++; setTimeout(q, 500); }
          });
          U.$('#clr').onclick = () => { out = []; U.$('#out').textContent = ''; U.$$('[data-k]').forEach(b => b.disabled = false); };
        });
      };
      return q();
    }
    const prompt = st.kind === 'read' ? st.text : st.prompt;
    U.view('Diagnóstico', head + `<div class="card"><p>${h(prompt)}</p>${U.speakBtn(prompt, 'Escuchar instrucción')}</div><div id="rec"></div><p class="small muted">Esto no es un examen. Solo muestra tu punto de partida.</p>${skip}`, () => {
      U.$('#later').onclick = () => U.go('home', null, true);
      U.recorder(U.$('#rec'), { prompt, title: 'Diagnóstico: ' + st.title, kind: 'diagnostico', sec: st.sec, readingText: st.kind === 'read' ? st.text : null, doneLabel: 'Siguiente prueba', onDone: (item) => next({ rec: item.id, report: item.report }) });
    });
  });

  const lvlWord = n => n >= 3 ? 'Sólido' : n === 2 ? 'Intermedio' : n === 1 ? 'En desarrollo' : 'Sin datos suficientes';
  function buildDiag() {
    const R = EP.state.diagnostic.results, sp = ['d1', 'd2', 'd3', 'd4', 'd8'].map(k => R[k] && R[k].report).filter(Boolean);
    /* Con tomas muy cortas no hay evidencia para estimar un nivel. */
    const withText = sp.filter(r => r.hasTranscript && r.text.words >= 15), withAudio = sp.filter(r => r.audio && !r.audio.tooQuiet && r.audio.durationSec >= 15);
    const avg = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : null;
    const longest = avg(withAudio, r => r.audio.longestPause), parts = avg(withText, r => r.structure.parts), vary = avg(withText, r => r.text.variety), conn = avg(withText, r => r.text.connectorTypes), fills = avg(withText.filter(r => r.fillersPerMin != null), r => r.fillersPerMin);
    const voc = R.d5 ? R.d5.correct / R.d5.total : null, reading = R.d7 && R.d7.report ? R.d7.report.reading : null;
    const skill = (name, val, level, tag, note) => ({ name, val, level, tag, note });
    const skills = [
      skill('Continuidad al hablar', longest == null ? 'Sin datos' : `Pausa mayor promedio: ${longest.toFixed(1)} s`, longest == null ? 0 : longest > 5 ? 1 : longest > 2.5 ? 2 : 3, 'medido'),
      skill('Organización de ideas', parts == null ? 'Sin datos' : `${parts.toFixed(1)} de 3 partes`, parts == null ? 0 : parts < 1.7 ? 1 : parts < 2.6 ? 2 : 3, 'estimado'),
      skill('Conectores', conn == null ? 'Sin datos' : `${conn.toFixed(1)} tipos por respuesta`, conn == null ? 0 : conn < 1.5 ? 1 : conn < 3 ? 2 : 3, 'estimado'),
      skill('Vocabulario al hablar', vary == null ? 'Sin datos' : `Variedad de ${Math.round(vary * 100)} %`, vary == null ? 0 : vary < 0.55 ? 1 : vary < 0.75 ? 2 : 3, 'estimado'),
      skill('Conocimiento de vocabulario', voc == null ? 'Sin datos' : `${Math.round(voc * 100)} % correcto`, voc == null ? 0 : voc < 0.5 ? 1 : voc < 0.85 ? 2 : 3, 'medido'),
      skill('Muletillas', fills == null ? 'Sin datos' : `${fills.toFixed(1)} posibles por minuto`, fills == null ? 0 : fills > 8 ? 1 : fills > 3 ? 2 : 3, 'estimado'),
      skill('Lectura en voz alta', reading == null ? 'Sin datos' : `${reading} % de coincidencia`, reading == null ? 0 : reading < 75 ? 1 : reading < 92 ? 2 : 3, 'estimado')
    ];
    const known = skills.filter(s => s.level > 0).sort((a, b) => a.level - b.level);
    const plan = known.slice(0, 3).map(s => ({
      'Continuidad al hablar': 'Nivel 1: práctica de 30, 45 y 60 segundos y frases de rescate.', 'Organización de ideas': 'Nivel 1: principio, desarrollo y conclusión. Estructura Punto-Razón-Ejemplo-Punto.', 'Conectores': 'Nivel 2: conectores para no perder el hilo.', 'Vocabulario al hablar': 'Palabra del día y palabras exactas.', 'Conocimiento de vocabulario': 'Cinco palabras al día y repaso espaciado.', 'Muletillas': 'Reemplazar muletillas por silencios breves.', 'Lectura en voz alta': 'Nivel 3: articulación y lectura expresiva.'
    }[s.name]));
    return { skills, strengths: known.slice().reverse().filter(s => s.level >= 2).slice(0, 3).map(s => s.name), difficulties: known.filter(s => s.level === 1).map(s => s.name), plan: plan.length ? plan : ['Empieza por el nivel 1 y completa una toma con transcripción.'], snapshot: { longest, parts, conn, fills, vary } };
  }
  U.route('diagReport', () => {
    const d = EP.state.diagnostic; if (!d.report) return U.go('diagnostic', null, true);
    const r = d.report;
    U.view('Tu informe inicial', `<p class="muted">Realizado el ${U.fmtDate(d.at)}. Es orientativo, no médico, psicológico ni clínico.</p>
      <div class="card"><h3 style="margin-top:0">Fortalezas</h3><p>${r.strengths.length ? h(r.strengths.join(', ')) : 'Aún no hay datos suficientes para señalar fortalezas.'}</p><h3>Dificultades</h3><p>${r.difficulties.length ? h(r.difficulties.join(', ')) : 'Ninguna marcada con los datos disponibles.'}</p></div>
      <div class="card"><h3 style="margin-top:0">Nivel estimado por habilidad</h3>${r.skills.map(s => `<div class="metric"><span>${h(s.name)}<br><span class="small muted">${h(s.val)}</span></span><span class="row"><b>${lvlWord(s.level)}</b>${U.tag(s.tag)}</span></div>`).join('')}</div>
      <div class="card"><h3 style="margin-top:0">Tus prioridades y plan inicial</h3><ol>${r.plan.map(x => `<li>${h(x)}</li>`).join('')}</ol></div>
      <button class="btn primary block" data-go="home">Ir a mi panel</button>`);
  });

  /* ---------- Panel principal ---------- */
  const TOOLS = [['coach', 'Entrenador oral', 'mic'], ['impro', 'Improvisación', 'flash'], ['conv', 'Conversaciones', 'talk'], ['nego', 'Negociación', 'deal'], ['lab', 'Laboratorio de acento', 'wave'], ['rehearsal', 'Ensayo real', 'flag'], ['video', 'Modo videos', 'cam'], ['structures', 'Estructuras', 'list'], ['rescue', 'Frases de rescate', 'bulb'], ['before', 'Antes de hablar', 'clock'], ['missions', 'Misión y diario', 'flag'], ['products', 'Mis productos', 'box'], ['recordings', 'Grabaciones', 'folder'], ['history', 'Historial', 'list'], ['profile', 'Perfil', 'user'], ['settings', 'Configuración', 'gear'], ['models', 'Modelos de voz', 'test']];
  U.nextLesson = function () {
    const ls = U.levelStatus();
    for (const lv of EP.LEVELS) {
      if (!ls[lv.id].unlocked || ls[lv.id].passed) continue;
      const i = lv.lessons.findIndex((_, k) => !EP.state.lessonsDone[lv.id + '-' + k]);
      return { level: lv, index: i };
    }
    return null;
  };
  U.route('home', () => {
    const st = EP.state, nl = U.nextLesson(), due = S.dueCards(st.cards, Date.now()).length, day = S.dayKey(), today = todayList();
    const newLeft = today.filter(w => !st.cards[w]).length;
    const diagPending = !st.diagnostic.done;
    U.view('', `<div class="row between"><div><div class="muted small">Hola${st.profile.name ? ', ' + h(st.profile.name) : ''}</div><h1 style="margin:0">ELOQUENT PRO</h1></div></div>
      ${P.isNative ? '' : '<div class="quote small">Vista previa en el navegador: aquí no hay grabación ni voz sin conexión, y tus datos pueden borrarse. La app Android incluye todo eso.</div>'}
      ${diagPending ? `<button class="card tap" data-go="diagnostic" style="border-color:var(--gold)"><span class="grow"><b>Completa tu diagnóstico</b><br><span class="muted small">Prueba ${st.diagnostic.step + 1} de ${EP.DIAGNOSTIC.length}. Lo necesitas para abrir la Academia.</span></span>${U.icon('play')}</button>` : ''}
      <div class="hero"><h2 style="margin-top:0">Entrenar ahora</h2><p class="muted small">Un toque y empiezas. Elige tu tiempo:</p>
        <div class="row" id="mins">${[3, 5, 10, 20].map(m => `<button class="chip ${st.profile.minutes === m ? 'on' : ''}" data-m="${m}">${m} min</button>`).join('')}</div>
        <button class="btn primary block" style="margin-top:12px" id="start">${U.icon('play')}Empezar sesión</button>
        <button class="btn ghost block" id="street">Estoy en la calle: práctica sin hablar en voz alta</button></div>
      ${nl ? `<button class="card tap" data-go="level" data-arg="${nl.level.id}"><span class="grow"><span class="muted small">Nivel ${nl.level.id}</span><br><b>${h(nl.level.name)}</b><br><span class="small muted">${nl.index < 0 ? 'Lecciones completas. Presenta tu examen.' : 'Sigue: ' + h(nl.level.lessons[nl.index].title)}</span></span>${U.icon('book')}</button>` : ''}
      <button class="card tap" data-go="vocab"><span class="grow"><b>Palabra del día</b><br><span class="small muted">${newLeft ? newLeft + ' nuevas' : today.length ? 'Las de hoy ya están vistas' : 'Se acabaron las nuevas: sigue con repaso'} · ${due} por repasar</span></span>${U.icon('words')}</button>
      <button class="btn block" data-go="before">${U.icon('clock')}Voy a hablar ya: preparación de 60 s</button>
      <h2>Todas las herramientas</h2><div class="grid2">${TOOLS.map(t => `<button class="card tap" style="margin:0" data-go="${t[0]}">${U.icon(t[2])}<span class="grow small"><b>${h(t[1])}</b></span></button>`).join('')}</div>${U.brand()}`, () => {
      U.$$('#mins [data-m]').forEach(b => b.onclick = () => { st.profile.minutes = +b.dataset.m; EP.save(); U.$$('#mins [data-m]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      U.$('#start').onclick = () => U.go('session', { street: false });
      U.$('#street').onclick = () => U.go('session', { street: true });
    });
  });
  function todayList() { const st = EP.state, d = S.dayKey(); const l = S.todayWords(EP.WORDS, st.cards, d, st.assigned); if (!st.assigned[d]) { st.assigned[d] = l; EP.save(); } return l; }
  U.todayList = todayList;

  /* Sesión de un toque: arma una lista real según tiempo y lugar. */
  function buildSession(street) {
    const min = EP.state.profile.minutes, steps = [], due = S.dueCards(EP.state.cards, Date.now()), today = todayList().filter(w => !EP.state.cards[w]);
    if (due.length) steps.push({ go: 'review', label: `Repasar ${Math.min(due.length, min)} palabras` });
    if (today.length && min >= 5) steps.push({ go: 'vocab', label: 'Ver las palabras de hoy' });
    if (street) {
      steps.push({ go: 'structures', label: 'Estudiar una estructura y repasarla mentalmente' });
      steps.push({ go: 'rescue', label: 'Repasar frases de rescate' });
      if (min >= 10) steps.push({ go: 'modelListen', label: 'Escuchar un modelo de lectura con audífonos' });
    } else {
      const nl = U.nextLesson();
      steps.push({ go: 'impro', label: 'Improvisar sobre un tema', arg: min < 5 ? 30 : 60 });
      if (min >= 10 && nl && nl.index >= 0) steps.push({ go: 'lesson', arg: nl.level.id + '-' + nl.index, label: 'Lección: ' + nl.level.lessons[nl.index].title });
      if (min >= 20) steps.push({ go: 'conv', label: 'Una conversación simulada' });
    }
    return steps;
  }
  U.route('session', (a) => {
    const street = a && a.street, steps = buildSession(street), chk = (EP.state.days[S.dayKey()] || {}).checked || {};
    U.view(street ? 'Sesión en la calle' : `Sesión de ${EP.state.profile.minutes} minutos`, `${street ? '<div class="quote">Las pruebas orales quedan para un lugar tranquilo. Esto no cuenta como evaluación de voz.</div>' : ''}
      ${steps.map((s, i) => `<button class="card tap" data-i="${i}"><span class="tag ${chk[s.label] ? 'ok' : ''}">${chk[s.label] ? 'Hecho' : i + 1}</span><span class="grow">${h(s.label)}</span>${U.icon('play')}</button>`).join('')}`, () => {
      U.$$('[data-i]').forEach(b => b.onclick = () => {
        const s = steps[+b.dataset.i], k = S.dayKey(); EP.state.days[k] = EP.state.days[k] || { sec: 0, n: 0 }; EP.state.days[k].checked = EP.state.days[k].checked || {}; EP.state.days[k].checked[s.label] = true; EP.save();
        U.go(s.go, s.arg);
      });
    });
  });
  U.route('modelListen', () => {
    const t = pick(EP.READINGS);
    U.view('Escuchar un modelo', `<div class="card"><p>${h(t)}</p><div class="row">${U.speakBtn(t, 'Normal')}<button class="btn sm" data-say="${h(t)}" data-rate="0.7">Lento</button></div></div><p class="muted">Sigue el texto y fíjate dónde hace pausas.</p>`);
  });

  /* ---------- Academia ---------- */
  U.route('academy', () => {
    if (!EP.state.diagnostic.done) return U.view('Academia', `<div class="card"><h3 style="margin-top:0">Primero, tu diagnóstico</h3><p class="muted">Para ajustar el plan a ti, la Academia se abre al terminar el diagnóstico. Mientras tanto, puedes usar el resto de las herramientas.</p><button class="btn primary block" data-go="diagnostic">Continuar diagnóstico</button></div>`);
    const ls = U.levelStatus();
    const mode = EP.state.profile.mode;
    U.view('', `<h1>Academia</h1><div class="row" style="margin-bottom:8px">${[['profesor', 'Profesor'], ['entrenador', 'Entrenador'], ['libre', 'Conversación libre']].map(m => `<button class="chip ${mode === m[0] ? 'on' : ''}" data-mode="${m[0]}">${m[1]}</button>`).join('')}</div>
      <p class="small muted" id="modeDesc">${modeText(mode)}</p>
      ${EP.LEVELS.map(lv => {
      const s = ls[lv.id], done = lv.lessons.filter((_, i) => EP.state.lessonsDone[lv.id + '-' + i]).length;
      return `<button class="card tap" ${s.unlocked ? `data-go="level" data-arg="${lv.id}"` : `data-locked="${lv.id}"`}>
        <span class="grow"><span class="muted small">Nivel ${lv.id}</span>${s.passed ? ' <span class="tag ok">Aprobado</span>' : ''}<br><b>${h(lv.name)}</b>
        <div class="progress"><i style="width:${100 * done / lv.lessons.length}%"></i></div><span class="small muted">${done} de ${lv.lessons.length} lecciones · Examen: ${s.passDays} de 2 días</span></span>${s.unlocked ? U.icon('book') : U.icon('lock')}</button>`;
    }).join('')}`, () => {
      U.$$('[data-mode]').forEach(b => b.onclick = () => { EP.state.profile.mode = b.dataset.mode; EP.save(); if (b.dataset.mode === 'libre') U.go('conv'); else U.refresh(); });
      U.$$('[data-locked]').forEach(b => b.onclick = () => U.toast(+b.dataset.locked === 8 ? 'El nivel 8 se abre al aprobar los niveles 1 al 7.' : 'Aprueba el nivel anterior en dos días distintos para abrir este.'));
    });
  });
  const modeText = m => ({ profesor: 'Modo profesor: explica, demuestra con un modelo y guía paso a paso.', entrenador: 'Modo entrenador: va directo a la práctica. El modelo se muestra solo si lo pides.', libre: 'Modo conversación libre: practica simulaciones sin seguir lecciones.' }[m]);
  U.route('level', (id) => {
    const lv = EP.LEVELS.find(l => l.id === +id), s = U.levelStatus()[lv.id];
    if (!s.unlocked) { U.toast('Este nivel sigue bloqueado.'); return U.back(); }
    const atts = (EP.state.attempts[lv.id] || []).slice(-3).reverse();
    const pending = lv.lessons.filter((_, i) => !EP.state.lessonsDone[lv.id + '-' + i]).length;
    U.view('Nivel ' + lv.id, `<h1>${h(lv.name)}</h1><p class="muted">${h(lv.goal)}</p>
      ${lv.lessons.map((l, i) => `<button class="card tap" data-go="lesson" data-arg="${lv.id}-${i}"><span class="tag ${EP.state.lessonsDone[lv.id + '-' + i] ? 'ok' : ''}">${EP.state.lessonsDone[lv.id + '-' + i] ? 'Hecha' : i + 1}</span><span class="grow">${h(l.title)}</span></button>`).join('')}
      <h2>Para aprobar</h2><div class="card">${lv.exam.map(e => `<p><b>${h(e.prompt)}</b></p><ul class="small">${e.criteria.map(c => `<li>${h(c.label)}</li>`).join('')}</ul>`).join('')}<p class="small muted">Debes aprobar en 2 días distintos. Los valores son iniciales y se pueden calibrar con tus datos.</p>
      <button class="btn primary block" ${pending ? 'disabled' : `data-go="exam" data-arg="${lv.id}"`}>${pending ? `Faltan ${pending} lecciones para el examen` : s.passed ? 'Volver a presentar' : 'Presentar examen'}</button></div>
      ${atts.length ? `<h3>Últimos intentos</h3>${atts.map(a => `<div class="metric"><span>${U.fmtDate(a.at)}</span><span class="tag ${a.passed ? 'ok' : 'bad'}">${a.passed ? 'Aprobado' : 'No aprobado'}</span></div>`).join('')}` : ''}`);
  });
  U.route('lesson', (key) => {
    const [lid, i] = String(key).split('-').map(Number), lv = EP.LEVELS.find(l => l.id === lid), l = lv.lessons[i], coach = EP.state.profile.mode === 'entrenador';
    const finish = () => { EP.state.lessonsDone[key] = S.dayKey(); EP.save(true); U.go('level', lid, true); };
    const teachText = l.teach.join(' ');
    const body = `<p>${l.teach.map(h).join('</p><p>')}</p><div class="row">${U.speakBtn(teachText, 'Escuchar lección')}</div>`;
    const model = `<div class="quote">${h(l.model)}</div>${U.speakBtn(l.model, 'Escuchar modelo')}`;
    U.view(`Nivel ${lid} · Lección ${i + 1}`, `<h1>${h(l.title)}</h1>
      ${coach ? `<details class="card"><summary>Ver explicación</summary>${body}<h3>Modelo</h3>${model}</details>` : `<div class="card">${body}<h3>Modelo</h3>${model}</div>`}
      <h2>Tu práctica</h2><div class="card"><p><b>${h(l.prompt)}</b></p>${U.speakBtn(l.prompt, 'Escuchar ejercicio')}</div><div id="rec"></div>
      <p class="small muted">Si estás en la calle, marca la lección para después o practica con voz baja.</p>`, () => {
      U.recorder(U.$('#rec'), { prompt: l.prompt, title: l.title, kind: 'leccion', sec: l.sec, group: 'lesson-' + key, doneLabel: 'Completar lección', onDone: finish });
    });
  });

  /* ---------- Examen ---------- */
  U.route('exam', (id) => {
    const lv = EP.LEVELS.find(l => l.id === +id);
    if (!U.levelStatus()[lv.id].unlocked) { U.toast('Este nivel sigue bloqueado.'); return U.back(); }
    const res = [];
    const step = (k) => {
      const task = lv.exam[k];
      if (!task) return finish();
      const prompt = task.topic ? (task.hard ? pick(EP.TOPICS[4]) : pick(EP.TOPICS[lv.id >= 5 ? 3 : 2])) : task.reading ? pick(EP.READINGS) : task.prompt;
      const selfs = task.criteria.filter(c => c.type === 'self');
      const selfHtml = selfs.length ? `<div class="card" id="selfBox"><h3 style="margin-top:0">Autoevaluación</h3><p class="small muted">Respóndela con honestidad al escucharte. Solo tú puedes verla.</p>${selfs.map(c => `<label class="check"><input type="checkbox" data-self="${c.id}"><span>${h(c.label)}</span></label>`).join('')}</div>` : '';
      const readSelf = () => { const o = {}; U.$$('[data-self]').forEach(x => { o[x.dataset.self] = x.checked; }); return o; };
      const evaluate = (report) => {
        const ev = EP.exams.evaluateTask(task, report, readSelf());
        res.push({ task: task.id, prompt, ev });
        if (!ev.valid) { U.toast(ev.reason); res.pop(); return false; }
        return true;
      };
      if (task.sim) {
        const sc = EP.SCENARIOS.find(s => s.id === task.sim);
        U.view(`Examen · Parte ${k + 1} de ${lv.exam.length}`, `<div class="card"><p><b>${h(task.prompt)}</b></p></div><div id="simh"></div><div id="after"></div>`, () => {
          U.simPlayer(U.$('#simh'), sc, (rep) => {
            U.$('#after').innerHTML = selfHtml + '<button class="btn primary block" id="n">Continuar</button>';
            U.$('#n').onclick = () => { if (evaluate({ text: {}, structure: {}, audio: null, hasTranscript: true })) step(k + 1); };
          });
        });
        return;
      }
      U.view(`Examen · Parte ${k + 1} de ${lv.exam.length}`, `<div class="card"><p><b>${h(task.topic ? 'Tema al azar' : task.reading ? 'Lee este texto en voz alta' : task.prompt)}</b></p>${task.topic || task.reading ? `<p class="quote">${h(prompt)}</p>` : ''}<ul class="small muted">${task.criteria.map(c => `<li>${h(c.label)}</li>`).join('')}</ul></div><div id="rec"></div>${selfHtml}`, () => {
        U.recorder(U.$('#rec'), { prompt, title: `Examen nivel ${lv.id}`, kind: 'examen', sec: task.sec, readingText: task.reading ? prompt : null, noFeedback: true, group: 'exam-' + task.id, doneLabel: 'Evaluar esta parte', onDone: (item, report) => { if (evaluate(item.report)) step(k + 1); } });
      });
    };
    const finish = () => {
      const passed = res.every(r => r.ev.passed);
      const att = { at: Date.now(), day: S.dayKey(), passed, res: res.map(r => ({ task: r.task, passed: r.ev.passed, results: r.ev.results })) };
      (EP.state.attempts[lv.id] = EP.state.attempts[lv.id] || []).push(att);
      EP.touchDay(0); EP.save(true);
      const st = U.levelStatus()[lv.id], all = res.flatMap(r => r.ev.results), fix = EP.exams.corrective(all);
      U.view('Informe del examen', `<h1>${passed ? 'Parte aprobada' : 'Aún no'}</h1><p>${passed ? (st.passed ? `Aprobaste el nivel ${lv.id} en dos días distintos. Felicitaciones.` : 'Aprobaste hoy. Para confirmar que no fue suerte, vuelve a presentarlo otro día.') : 'No pasa nada: ya sabes exactamente qué entrenar.'}</p>
        ${res.map(r => `<div class="card"><p class="small muted">${h(r.prompt)}</p>${r.ev.results.map(x => `<div class="metric"><span>${h(x.label)}<br><span class="small muted">${h(x.value)}</span></span><span class="row">${U.tag(x.tag)}<span class="tag ${x.ok ? 'ok' : 'bad'}">${x.ok ? 'Cumple' : 'Falta'}</span></span></div>`).join('')}</div>`).join('')}
        ${fix.length ? `<div class="card"><h3 style="margin-top:0">Ejercicios correctivos</h3><ul>${fix.map(x => `<li>${h(x)}</li>`).join('')}</ul></div>` : ''}
        <button class="btn primary block" data-go="level" data-arg="${lv.id}">Volver al nivel</button>`);
    };
    step(0);
  });
})(typeof window !== 'undefined' ? window : globalThis);
