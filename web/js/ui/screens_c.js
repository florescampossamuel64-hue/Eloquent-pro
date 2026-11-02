(function (root) {
  const EP = root.EP, U = EP.ui, h = U.h, S = EP.srs, A = EP.analysis, P = EP.platform;
  const mb = b => b == null ? 'No disponible' : (b / 1048576).toFixed(1) + ' MB';

  /* ---------- Grabaciones e historial ---------- */
  const KINDS = { leccion: 'Lección', examen: 'Examen', entrenador: 'Entrenador', improvisacion: 'Improvisación', palabra: 'Palabra', simulacion: 'Simulación', laboratorio: 'Laboratorio', diagnostico: 'Diagnóstico', video: 'Video', ensayo: 'Ensayo', banco: 'Banco de Pruebas', mision: 'Misión' };
  U.route('recordings', () => {
    const l = EP.state.recordings;
    U.view('Grabaciones', `<div class="card"><div class="metric"><span>Grabaciones</span><b>${l.length}</b></div><div class="metric"><span>Espacio usado por la app</span><b id="used">...</b></div><div class="metric"><span>Espacio libre</span><b id="free">...</b></div>
      <button class="btn danger block" id="delAll" ${l.length ? '' : 'disabled'}>Borrar todas las grabaciones</button><p class="small muted">Se conservan tus métricas para no perder tu progreso.</p></div>
      ${l.length ? l.map(r => `<div class="card"><button class="tap" style="all:unset;display:block;cursor:pointer;width:100%" data-go="recording" data-arg="${r.id}"><b>${h(r.title)}</b>${r.deleted ? ' <span class="tag">Audio borrado</span>' : ''}<br><span class="small muted">${KINDS[r.kind] || r.kind} · ${U.fmtDate(r.at)}${r.report && r.report.audio ? ' · ' + U.fmtTime(r.report.audio.durationSec) : ''}</span></button></div>`).join('') : '<div class="list-empty">Aún no hay grabaciones. Empieza con el Entrenador oral.</div>'}`, async () => {
      const s = await P.storage(); if (U.$('#used')) { U.$('#used').textContent = mb(s.bytes); U.$('#free').textContent = mb(s.free); }
      U.$('#delAll').onclick = async () => {
        if (!await U.confirm('¿Borrar todos los audios? Esto no se puede deshacer.')) return;
        for (const r of EP.state.recordings) { await P.deleteAudio(r.id); r.deleted = true; }
        EP.save(true); U.toast('Audios borrados.'); U.refresh();
      };
    });
  });
  U.confirm = msg => new Promise(res => {
    const d = document.createElement('div'); d.className = 'splash'; d.style.background = 'rgba(5,10,22,.8)';
    d.innerHTML = `<div class="card" style="max-width:340px"><p>${h(msg)}</p><div class="row"><button class="btn grow" id="cn">Cancelar</button><button class="btn danger grow" id="cy">Confirmar</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('#cn').onclick = () => { d.remove(); res(false); };
    d.querySelector('#cy').onclick = () => { d.remove(); res(true); };
  });
  U.route('recording', (id) => {
    const r = EP.state.recordings.find(x => x.id === id); if (!r) return U.back();
    U.view('Grabación', `<label for="nm">Nombre</label><input id="nm" value="${h(r.title)}"><p class="small muted">${KINDS[r.kind] || r.kind} · ${U.fmtDate(r.at)}</p>
      ${r.prompt ? `<div class="quote small">${h(r.prompt)}</div>` : ''}
      <div class="row">${r.deleted ? '<span class="tag">Audio borrado</span>' : U.playerHtml(r.id) + `<button class="btn sm" id="exp">Exportar</button>`}<button class="btn sm danger" id="del" ${r.deleted ? 'disabled' : ''}>Eliminar audio</button></div>
      <label for="tx">Transcripción</label><textarea id="tx">${h(r.text)}</textarea><button class="btn sm" id="sv">Guardar y recalcular</button>
      ${U.metricsHtml(r.report)}${r.report ? U.feedbackHtml(A.feedback(r.report, {})) : ''}
      ${U.compareOptions(r)}`, () => {
      U.wirePlayers(U.$('#app'));
      U.$('#nm').onchange = e => { r.title = e.target.value.trim() || r.title; EP.save(); U.toast('Nombre actualizado.'); };
      if (U.$('#exp')) U.$('#exp').onclick = () => P.shareRec(r.id, r.title.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').trim() || 'grabacion');
      U.$('#del').onclick = async () => { if (await U.confirm('¿Eliminar este audio?')) { await P.deleteAudio(r.id); r.deleted = true; EP.save(true); U.refresh(); } };
      U.$('#sv').onclick = async () => {
        r.text = U.$('#tx').value.trim();
        if (!r.deleted) r.report = await U.analyze(r.id, r.text, {});
        else { const au = r.report && r.report.audio; r.report = A.report({ text: r.text, audio: au, fillers: EP.state.profile.fillers }); }
        EP.save(true); U.toast('Evaluación actualizada.'); U.refresh();
      };
      const sel = U.$('#cmpSel');
      if (sel) sel.onchange = () => { U.$('#cmpBox').innerHTML = U.compareTable(EP.state.recordings.find(x => x.id === sel.value), r); U.wirePlayers(U.$('#cmpBox')); };
    });
  });
  U.compareOptions = r => {
    const others = EP.state.recordings.filter(x => x.id !== r.id && x.report && x.report.audio).slice(0, 30);
    return others.length ? `<div class="card"><label for="cmpSel" style="margin-top:0">Comparar con otra grabación</label><select id="cmpSel"><option value="">Elige una</option>${others.map(o => `<option value="${o.id}">${h(o.title)} · ${U.fmtDate(o.at)}</option>`).join('')}</select><div id="cmpBox"></div></div>` : '';
  };
  U.compareTable = (a, b) => {
    if (!a) return '';
    const v = (o, f, u) => { const x = f(o); return x == null ? '-' : x + (u || ''); };
    const rows = [['Duración', o => o.report.audio && Math.round(o.report.audio.durationSec), ' s'], ['Pausa mayor', o => o.report.audio && o.report.audio.longestPause, ' s'], ['Palabras/min', o => o.report.wpm], ['Muletillas/min', o => o.report.fillersPerMin], ['Variación de tono', o => o.report.audio && o.report.audio.pitch && o.report.audio.pitch.variationSemis, ' st']];
    return rows.map(r => `<div class="metric"><span>${r[0]}</span><span>${v(a, r[1], r[2])} → <b>${v(b, r[1], r[2])}</b></span></div>`).join('') + `<div class="row" style="margin-top:6px">${a.deleted ? '' : U.playerHtml(a.id, 'Otra')}${b.deleted ? '' : U.playerHtml(b.id, 'Esta')}</div>`;
  };
  U.route('history', () => {
    const st = EP.state, ev = [];
    st.recordings.forEach(r => ev.push({ at: r.at, t: KINDS[r.kind] || 'Práctica', d: r.title, go: 'recording', arg: r.id }));
    st.sims.forEach(s => ev.push({ at: s.at, t: 'Simulación', d: `${s.title}: ${s.outcome}` }));
    Object.keys(st.attempts).forEach(k => st.attempts[k].forEach(a => ev.push({ at: a.at, t: 'Examen', d: `Nivel ${k}: ${a.passed ? 'aprobado' : 'no aprobado'}`, go: 'level', arg: k })));
    ev.sort((a, b) => b.at - a.at);
    U.view('Historial', ev.length ? ev.slice(0, 120).map(e => `<button class="card tap" ${e.go ? `data-go="${e.go}" data-arg="${e.arg}"` : ''}><span class="grow small"><b>${h(e.t)}</b> · ${U.fmtDate(e.at)}<br><span class="muted">${h(e.d)}</span></span></button>`).join('') : '<div class="list-empty">Aquí verás tu práctica cuando empieces.</div>');
  });

  /* ---------- Estadísticas ---------- */
  U.route('stats', () => {
    const st = EP.state, ls = U.levelStatus(), recs = st.recordings.slice().reverse(), good = recs.filter(r => r.report && r.report.reliable);
    const cur = EP.LEVELS.find(l => !ls[l.id].passed) || EP.LEVELS[7];
    const days = Object.keys(st.days).filter(k => st.days[k].n > 0).length, totalSec = Object.values(st.days).reduce((s, d) => s + (d.sec || 0), 0);
    const cards = Object.values(st.cards), passed = EP.LEVELS.filter(l => ls[l.id].passed).length, lessons = Object.keys(st.lessonsDone).length, total = EP.LEVELS.reduce((s, l) => s + l.lessons.length, 0);
    const wpm = good.filter(r => r.report.wpm).map(r => r.report.wpm), fill = good.filter(r => r.report.fillersPerMin != null).map(r => r.report.fillersPerMin), pause = good.map(r => r.report.audio.longestPause);
    const impro = good.filter(r => r.kind === 'improvisacion').map(r => r.report.audio.durationSec), sims = st.sims.filter(s => !s.commercial), sales = st.sims.filter(s => s.commercial);
    const winrate = l => l.length ? `${l.filter(s => /acuerdo$|conexión|confianza/.test(s.outcome) && !/sin/.test(s.outcome)).length} de ${l.length}` : 'Sin datos';
    const reading = good.filter(r => r.report.reading != null).map(r => r.report.reading);
    const d0 = st.diagnostic.report && st.diagnostic.report.snapshot;
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null, recent = (a, n) => avg(a.slice(-n));
    const cmp = [];
    if (d0) {
      const rowsC = [['Pausa mayor', d0.longest, recent(pause, 5), ' s'], ['Posibles muletillas/min', d0.fills, recent(fill, 5), ''], ['Partes de estructura', d0.parts, recent(good.filter(r => r.report.hasTranscript).map(r => r.report.structure.parts), 5), '/3']];
      for (const r of rowsC) cmp.push(`<div class="metric"><span>${r[0]}</span><span>${r[1] == null ? '-' : r[1].toFixed(1) + r[3]} → <b>${r[2] == null ? '-' : r[2].toFixed(1) + r[3]}</b></span></div>`);
    }
    U.view('', `<h1>Tu progreso</h1><p class="small muted">Solo datos reales de tus prácticas. Cada indicador va por separado: no hay nota única.</p>
      <div class="card"><div class="metric"><span>Nivel actual</span><b>${cur.id}. ${h(cur.name)}</b></div><div class="metric"><span>Niveles aprobados</span><b>${passed} de 8</b></div><div class="metric"><span>Lecciones completadas</span><b>${lessons} de ${total}</b></div><div class="metric"><span>Días de práctica</span><b>${days}</b></div><div class="metric"><span>Tiempo total hablando</span><b>${U.fmtTime(totalSec)}</b></div>
      <div class="metric"><span>Palabras en estudio</span><b>${cards.length}</b></div><div class="metric"><span>Palabras usadas al hablar</span><b>${cards.filter(c => c.state >= 3).length}</b></div><div class="metric"><span>Palabras dominadas</span><b>${cards.filter(c => c.state === 5).length}</b></div>
      <div class="metric"><span>Conversaciones con buen resultado</span><b>${winrate(sims)}</b></div><div class="metric"><span>Negociaciones con acuerdo</span><b>${winrate(sales)}</b></div></div>
      ${d0 ? `<div class="card"><h3 style="margin-top:0">Diagnóstico inicial → últimas 5 tomas válidas</h3>${cmp.join('')}<button class="btn sm" data-go="diagReport" style="margin-top:8px">Ver informe inicial</button></div>` : ''}
      <div class="card">${U.lineChart(wpm, 'Palabras por minuto', 'ppm')}${U.lineChart(fill, 'Posibles muletillas por minuto', '')}${U.lineChart(pause, 'Pausa mayor', 's')}${U.lineChart(impro, 'Duración en improvisación', 's')}${U.lineChart(reading, 'Coincidencia en lectura', '%')}</div>
      <p class="small muted">Las tomas con ruido alto no se incluyen. Las palabras por minuto y las muletillas dependen de la transcripción, y son estimadas.</p>`);
  });

  /* ---------- Perfil, productos, misiones ---------- */
  U.route('profile', () => {
    const p = EP.state.profile;
    U.view('Perfil', `<label for="n">Nombre</label><input id="n" value="${h(p.name)}">
      <label for="f">Mis muletillas (separadas por coma)</label><textarea id="f">${h(p.fillers.join(', '))}</textarea><p class="small muted">Se marcan como posibles: muchas son correctas según el contexto.</p>
      <button class="btn primary block" id="sv">Guardar</button>
      <button class="card tap" data-go="products"><span class="grow"><b>Mis productos</b></span>${U.icon('box')}</button><button class="card tap" data-go="missions"><span class="grow"><b>Misión y diario</b></span>${U.icon('flag')}</button><button class="card tap" data-go="diagReport" ${EP.state.diagnostic.done ? '' : 'disabled'}><span class="grow"><b>Mi diagnóstico inicial</b></span></button>
      <button class="btn ghost block" id="redo">Repetir el diagnóstico</button><p class="small muted">Sugerido cada 30 días, en condiciones parecidas. Tu informe anterior se reemplaza; tus grabaciones se conservan.</p>`, () => {
      U.$('#sv').onclick = () => { p.name = U.$('#n').value.trim(); p.fillers = U.$('#f').value.split(',').map(x => A.normalize(x)).filter(Boolean); EP.save(true); U.toast('Perfil guardado.'); };
      U.$('#redo').onclick = async () => { if (await U.confirm('¿Empezar otra vez el diagnóstico?')) { EP.state.diagnostic = { step: 0, results: {}, done: false, report: null, at: null }; EP.save(true); U.go('diagnostic'); } };
    });
  });
  U.route('products', () => {
    const l = EP.state.products;
    U.view('Mis productos', `${l.map((x, i) => `<div class="card"><div class="row between"><b>${h(x.name)}</b><button class="btn sm danger" data-del="${i}">Eliminar</button></div><p class="small muted">Cliente: ${h(x.client || '-')}<br>Precio: ${h(x.price || '-')}<br>Beneficios: ${h(x.benefits || '-')}<br>Objeciones: ${h(x.objections || '-')}</p>${i ? `<button class="btn sm" data-main="${i}">Usar en simulaciones</button>` : '<span class="tag ok">En simulaciones</span>'}</div>`).join('')}
      <div class="card"><h3 style="margin-top:0">Agregar producto o servicio</h3><label for="a">Nombre</label><input id="a"><label for="b">Cliente ideal</label><input id="b"><label for="c">Precio</label><input id="c"><label for="d">Beneficios</label><textarea id="d" style="min-height:60px"></textarea><label for="e">Objeciones comunes</label><textarea id="e" style="min-height:60px"></textarea><button class="btn primary block" id="add" style="margin-top:8px">Guardar</button></div>`, () => {
      U.$('#add').onclick = () => { const name = U.$('#a').value.trim(); if (!name) return U.toast('Escribe el nombre.'); l.push({ name, client: U.$('#b').value.trim(), price: U.$('#c').value.trim(), benefits: U.$('#d').value.trim(), objections: U.$('#e').value.trim() }); EP.save(true); U.refresh(); };
      U.$$('[data-del]').forEach(b => b.onclick = () => { l.splice(+b.dataset.del, 1); EP.save(true); U.refresh(); });
      U.$$('[data-main]').forEach(b => b.onclick = () => { const [x] = l.splice(+b.dataset.main, 1); l.unshift(x); EP.save(true); U.refresh(); });
    });
  });
  const weekKey = () => { const d = new Date(); return d.getFullYear() + '-' + Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000); };
  U.route('missions', () => {
    const st = EP.state, k = weekKey(), m = st.missions[k] = st.missions[k] || { i: Object.keys(st.missions).length % EP.MISSIONS.length, done: false };
    U.view('Misión y diario', `<div class="hero"><span class="small muted">Misión de esta semana, fuera de la app</span><p style="font-size:18px"><b>${h(EP.MISSIONS[m.i])}</b></p>${m.done ? '<span class="tag ok">Cumplida</span>' : ''}</div>
      <div class="card"><h3 style="margin-top:0">Cuenta qué pasó en una nota de voz</h3><div id="rec"></div></div>
      <div class="card"><h3 style="margin-top:0">Diario de situaciones reales</h3><label for="a">Qué salió bien</label><input id="a"><label for="b">Qué salió mal</label><input id="b"><label for="c">Qué voy a ensayar</label><input id="c"><button class="btn primary block" id="sv" style="margin-top:8px">Guardar en el diario</button></div>
      ${st.diary.map(d => `<div class="card small"><span class="muted">${U.fmtDate(d.at)}</span><p><b>Bien:</b> ${h(d.a)}<br><b>Mal:</b> ${h(d.b)}<br><b>Ensayar:</b> ${h(d.c)}</p>${d.c ? `<button class="btn sm" data-reh="${h(d.c)}">Ensayarlo ahora</button>` : ''}</div>`).join('')}`, () => {
      U.recorder(U.$('#rec'), { prompt: EP.MISSIONS[m.i], title: 'Misión de la semana', kind: 'mision', sec: 60, group: 'mision-' + k, noFeedback: true, doneLabel: 'Marcar misión como cumplida', onDone: () => { m.done = true; EP.save(true); U.refresh(); } });
      U.$('#sv').onclick = () => { const a = U.$('#a').value.trim(), b = U.$('#b').value.trim(), c = U.$('#c').value.trim(); if (!a && !b && !c) return U.toast('Escribe al menos una línea.'); st.diary.unshift({ at: Date.now(), a, b, c }); EP.save(true); U.refresh(); };
      U.$$('[data-reh]').forEach(b => b.onclick = () => U.go('rehearsal', b.dataset.reh));
    });
  });

  /* ---------- Herramientas ---------- */
  U.route('structures', () => U.view('Biblioteca de estructuras', EP.STRUCTURES.map((s, i) => `<details class="card" ${i ? '' : 'open'}><summary>${h(s.n)}</summary><p class="small muted">${h(s.use)}</p><ol>${s.steps.map(x => `<li>${h(x)}</li>`).join('')}</ol><p class="quote">${h(s.ex)}</p>${U.speakBtn(s.ex, 'Escuchar ejemplo')} <button class="btn sm" data-go="coach" data-arg="${h('Usa la estructura ' + s.n + ' para hablar de tu trabajo.')}">Practicar</button></details>`).join('')));
  U.route('rescue', () => U.view('Frases de rescate', `<p class="muted">Apréndelas para no quedarte en blanco.</p>${EP.RESCUE.map(r => `<div class="card"><h3 style="margin-top:0">${h(r.when)}</h3>${r.p.map(x => `<div class="metric"><span>${h(x)}</span>${U.speakBtn(x, 'Oír')}</div>`).join('')}</div>`).join('')}`));
  U.route('before', () => {
    let iv = null, left = 60;
    const STEPS = [[60, 'Respira lento: inhala 4 tiempos y exhala 6.'], [40, 'Decide una sola idea central.'], [30, 'Elige tres puntos: inicio, razón y ejemplo.'], [15, 'Di tu primera frase en voz baja, tres veces.'], [5, 'Listo. Mira a la persona y empieza despacio.']];
    U.view('Antes de hablar', `<div class="card" style="text-align:center"><div class="timer" id="tm">01:00</div><p id="tx" style="min-height:52px"><b>Tienes 60 segundos.</b></p><button class="btn primary block" id="go">Empezar</button></div>
      <label for="a">Mi idea central</label><input id="a"><label for="b">Mi primera frase</label><input id="b">`, () => {
      U.onLeave(() => clearInterval(iv));
      U.$('#go').onclick = () => {
        clearInterval(iv); left = 60; U.$('#go').textContent = 'Reiniciar';
        const tick = () => { const s = STEPS.slice().reverse().find(x => left <= x[0]) || STEPS[0]; if (U.$('#tx')) { U.$('#tx').textContent = s[1]; U.$('#tm').textContent = U.fmtTime(left); } if (left <= 0) { clearInterval(iv); U.$('#tx').textContent = 'Es tu momento.'; } left--; };
        tick(); iv = setInterval(tick, 1000);
      };
    });
  });
  U.route('rehearsal', (seed) => {
    const list = EP.state.rehearsals;
    U.view('Ensayo de una situación real', `<p class="muted">Prepara una reunión o llamada que tengas pronto.</p><label for="a">¿Con quién hablarás?</label><input id="a"><label for="b">¿Qué quieres lograr?</label><input id="b" value="${h(typeof seed === 'string' ? seed : '')}"><label for="c">¿Qué objeción o pregunta temes?</label><input id="c"><button class="btn primary block" id="mk" style="margin-top:10px">Armar ensayo</button>
      <div id="out"></div>${list.length ? `<h3>Ensayos anteriores</h3>${list.slice(0, 5).map((r, i) => `<button class="card tap" data-old="${i}"><span class="grow small"><b>${h(r.who)}</b>: ${h(r.goal)}<br><span class="muted">${U.fmtDate(r.at)}</span></span></button>`).join('')}` : ''}`, () => {
      const show = (r) => {
        const steps = [['Tu apertura', `Di cómo saludarás a ${r.who} y anuncia por qué hablas.`], ['Tu objetivo', `Explica en 30 segundos: ${r.goal}.`], ['La objeción', `${r.who} te dice: "${r.fear}". Responde: entiendo, pregunto, respondo y confirmo.`], ['Tu cierre', 'Pide un siguiente paso concreto, con fecha.']];
        let i = 0;
        const draw = () => {
          if (i >= steps.length) { U.$('#out').innerHTML = `<div class="card"><h3 style="margin-top:0">Ficha de repaso</h3><p><b>Con:</b> ${h(r.who)}</p><p><b>Lograr:</b> ${h(r.goal)}</p><p><b>Si dice:</b> ${h(r.fear)}</p><p><b>Estructura:</b> saludo, objetivo, respuesta a la objeción y siguiente paso con fecha.</p></div>`; return; }
          U.$('#out').innerHTML = `<div class="card"><span class="small muted">Paso ${i + 1} de ${steps.length}</span><h3>${h(steps[i][0])}</h3><p>${h(steps[i][1])}</p>${U.speakBtn(steps[i][1])}</div><div id="rec"></div>`;
          U.wire(U.$('#out'));
          U.recorder(U.$('#rec'), { prompt: steps[i][1], title: 'Ensayo: ' + r.who, kind: 'ensayo', group: 'ens-' + r.at + '-' + i, sec: i === 1 ? 30 : 45, onDone: () => { i++; draw(); }, doneLabel: 'Siguiente paso' });
        };
        draw();
      };
      U.$('#mk').onclick = () => {
        const who = U.$('#a').value.trim(), goal = U.$('#b').value.trim(), fear = U.$('#c').value.trim();
        if (!who || !goal || !fear) return U.toast('Completa los tres campos.');
        const r = { who, goal, fear, at: Date.now() }; list.unshift(r); EP.save(true); show(r);
      };
      U.$$('[data-old]').forEach(b => b.onclick = () => show(list[+b.dataset.old]));
    });
  });
  U.route('video', () => {
    let task = EP.VIDEO_TASKS[0], speed = 40, iv = null;
    const draw = () => {
      U.view('Modo videos', `<div class="row">${EP.VIDEO_TASKS.map(t => `<button class="chip ${t === task ? 'on' : ''}" data-t="${h(t.n)}">${h(t.n)}</button>`).join('')}</div>
        <p class="small muted" style="margin-top:6px">${h(task.tip)}</p>${task.n === 'Gancho' ? `<details><summary>Ideas para tu gancho</summary><ul class="small">${EP.HOOKS.map(x => `<li>${h(x)}</li>`).join('')}</ul></details>` : ''}
        <label for="sc">Tu texto</label><textarea id="sc" placeholder="Escribe o pega aquí lo que vas a decir">${h(task.text || '')}</textarea>
        <div class="row" style="margin:8px 0"><button class="btn sm" id="pr">Abrir teleprompter</button><span class="small muted">Velocidad</span><input id="sp" type="range" min="15" max="120" value="${speed}" style="flex:1"></div>
        <div class="prompter" id="pt" style="display:none"></div><div id="rec"></div>
        <p class="small muted">Se graba el audio para evaluar tu voz. Para grabar video, usa la cámara de tu teléfono mientras lees aquí.</p>`, () => {
        U.$$('[data-t]').forEach(b => b.onclick = () => { task.text = U.$('#sc').value; task = EP.VIDEO_TASKS.find(t => t.n === b.dataset.t); clearInterval(iv); draw(); });
        U.$('#sp').oninput = e => { speed = +e.target.value; };
        U.onLeave(() => clearInterval(iv));
        U.$('#pr').onclick = () => {
          const pt = U.$('#pt'), t = U.$('#sc').value.trim(); if (!t) return U.toast('Escribe primero tu texto.');
          task.text = t; pt.style.display = 'block'; pt.textContent = t + '\n\n\n\n\n\n'; pt.scrollTop = 0; clearInterval(iv);
          iv = setInterval(() => { pt.scrollTop += speed / 20; }, 50); U.$('#pr').textContent = 'Reiniciar teleprompter';
        };
        U.recorder(U.$('#rec'), { prompt: task.n, title: 'Video: ' + task.n, kind: 'video', sec: task.sec, group: 'video-' + task.n, readingText: null });
      });
    };
    draw();
  });

  /* ---------- Configuración ---------- */
  U.route('settings', () => {
    const p = EP.state.profile;
    U.view('Configuración', `<div class="card"><h3 style="margin-top:0">Apariencia</h3><div class="row"><button class="chip ${p.theme !== 'light' ? 'on' : ''}" data-th="dark">Oscuro</button><button class="chip ${p.theme === 'light' ? 'on' : ''}" data-th="light">Claro</button></div></div>
      <div class="card"><h3 style="margin-top:0">Modo de entrenamiento</h3><div class="row">${[['profesor', 'Profesor'], ['entrenador', 'Entrenador'], ['libre', 'Conversación libre']].map(m => `<button class="chip ${p.mode === m[0] ? 'on' : ''}" data-m="${m[0]}">${m[1]}</button>`).join('')}</div></div>
      <div class="card"><h3 style="margin-top:0">Voz del tutor</h3><label for="rate">Velocidad: <span id="rv">${p.rate}</span></label><input id="rate" type="range" min="0.5" max="1.4" step="0.1" value="${p.rate}"><label class="check"><input type="checkbox" id="auto" ${p.autoSpeak !== false ? 'checked' : ''}><span>Leer en voz alta las frases de las simulaciones</span></label>${U.speakBtn('Hola. Esta es la voz de tu tutor.', 'Probar voz')}</div>
      <div class="card"><h3 style="margin-top:0">Recordatorio diario</h3><label class="check"><input type="checkbox" id="rem" ${p.reminder.on ? 'checked' : ''}><span>Activar</span></label><input type="time" id="remT" value="${String(p.reminder.h).padStart(2, '0')}:${String(p.reminder.m).padStart(2, '0')}"></div>
      <div class="card"><h3 style="margin-top:0">PIN de privacidad</h3><p class="small muted">Es opcional. Protege tus grabaciones al abrir la app. Si lo olvidas, solo podrás recuperar tus datos con un respaldo.</p><div class="row"><button class="btn sm" id="pin">${p.pin ? 'Cambiar PIN' : 'Crear PIN'}</button>${p.pin ? '<button class="btn sm danger" id="unpin">Quitar PIN</button>' : ''}</div></div>
      <div class="card"><h3 style="margin-top:0">Respaldo</h3><p class="small muted">Desinstalar la app borra todo si no tienes copia.</p><div class="row"><button class="btn sm" id="exp">Exportar respaldo</button><button class="btn sm" id="imp">Importar respaldo</button></div></div>
      <button class="card tap" data-go="models"><span class="grow"><b>Administrador de modelos de voz</b><br><span class="small muted">Estado, Banco de Pruebas y licencias</span></span>${U.icon('test')}</button>
      <div class="card"><h3 style="margin-top:0">Borrar todo</h3><button class="btn danger block" id="wipe">Borrar todo el historial y empezar de nuevo</button></div>
      <div class="card"><h3 style="margin-top:0">Acerca de</h3><p>ELOQUENT PRO 1.0.0<br><b>${U.BRAND}</b></p><p class="small muted">No es un servicio médico ni clínico. Si tienes ronquera, dolor o fatiga vocal, descansa la voz. Si la dificultad continúa o hay tartamudez, un fonoaudiólogo puede orientarte.</p></div>${U.brand()}`, () => {
      U.$$('[data-th]').forEach(b => b.onclick = () => { p.theme = b.dataset.th; U.applyTheme(); EP.save(); U.refresh(); });
      U.$$('[data-m]').forEach(b => b.onclick = () => { p.mode = b.dataset.m; EP.save(); U.refresh(); });
      U.$('#rate').oninput = e => { p.rate = +e.target.value; U.$('#rv').textContent = p.rate; EP.save(); };
      U.$('#auto').onchange = e => { p.autoSpeak = e.target.checked; EP.save(); };
      const rem = () => { const [hh, mm] = U.$('#remT').value.split(':').map(Number); p.reminder = { on: U.$('#rem').checked, h: hh || 0, m: mm || 0 }; const ok = P.reminder(p.reminder.on, p.reminder.h, p.reminder.m); EP.save(); U.toast(ok ? (p.reminder.on ? 'Recordatorio activado.' : 'Recordatorio desactivado.') : 'Los recordatorios funcionan en la app instalada.'); };
      U.$('#rem').onchange = rem; U.$('#remT').onchange = rem;
      U.$('#pin').onclick = () => U.go('pin', { set: true });
      if (U.$('#unpin')) U.$('#unpin').onclick = () => { p.pin = null; EP.save(true); U.refresh(); };
      U.$('#exp').onclick = async () => { const r = await P.exportBackup(EP.state); U.toast(r.ok ? (r.note || 'Respaldo guardado.') : 'No se guardó el respaldo.'); };
      U.$('#imp').onclick = async () => {
        const r = await P.importBackup(); if (!r || !r.ok) return;
        try { const s = JSON.parse(r.json); if (!s.profile || !s.recordings) throw 0; if (!await U.confirm('¿Reemplazar tus datos actuales con este respaldo?')) return; EP.state = Object.assign(EP.defaultState(), s); EP.save(true); U.applyTheme(); U.toast('Respaldo restaurado.'); U.go('home', null, true); } catch (e) { U.toast('El archivo no es un respaldo válido.'); }
      };
      U.$('#wipe').onclick = async () => {
        if (!await U.confirm('Se borrarán grabaciones, progreso y perfil. No se puede deshacer.')) return;
        for (const r of EP.state.recordings) await P.deleteAudio(r.id);
        EP.state = EP.defaultState(); await EP.save(true); U.applyTheme(); U.go('welcome', null, true);
      };
    });
  });
  async function sha(s) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ep:' + s)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { let v = 7; for (const c of 'ep:' + s) v = (v * 31 + c.charCodeAt(0)) >>> 0; return 'x' + v; } }
  U.route('pin', (a) => {
    const set = a && a.set; let v = '', first = null;
    const paint = (msg) => {
      U.view('', `<div style="text-align:center;margin-top:40px"><div class="logo" style="font-size:24px">ELOQUENT PRO</div><p id="m">${h(msg)}</p><div class="timer" id="d" style="letter-spacing:8px;min-height:44px">${'•'.repeat(v.length)}</div></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="c" aria-label="Borrar">←</button><button data-k="0">0</button><button data-k="ok">OK</button></div>${set ? '<button class="btn ghost block" id="cancel">Cancelar</button>' : ''}${U.brand()}`, () => {
        if (set) U.$('#cancel').onclick = U.back;
        U.$$('[data-k]').forEach(b => b.onclick = async () => {
          const k = b.dataset.k;
          if (k === 'c') { v = v.slice(0, -1); U.$('#d').textContent = '•'.repeat(v.length); return; }
          if (k !== 'ok') { if (v.length < 8) v += k; U.$('#d').textContent = '•'.repeat(v.length); return; }
          if (v.length < 4) return U.toast('El PIN debe tener al menos 4 números.');
          const hx = await sha(v);
          if (set) {
            if (!first) { first = hx; v = ''; return paint('Repite el PIN'); }
            if (first !== hx) { first = null; v = ''; return paint('No coincide. Escribe un PIN nuevo'); }
            EP.state.profile.pin = hx; EP.save(true); U.toast('PIN guardado.'); return U.back();
          }
          if (hx === EP.state.profile.pin) U.go('home', null, true); else { v = ''; paint('PIN incorrecto. Intenta otra vez'); }
        });
      });
    };
    paint(set ? 'Escribe un PIN nuevo' : 'Escribe tu PIN');
  });

  /* ---------- Modelos de voz y Banco de Pruebas ---------- */
  U.route('models', () => {
    const m = P.model(), t = P.ttsInfo(), d = P.device(), b = EP.state.benches;
    U.view('Modelos de voz', `<div class="card"><h3 style="margin-top:0">Reconocimiento de voz</h3><div class="metric"><span>Modelo</span><b>${h(m.name)}</b></div><div class="metric"><span>Estado</span><span class="tag ${m.ready ? 'ok' : 'bad'}">${m.ready ? 'Listo, sin internet' : 'No disponible aquí'}</span></div>${m.sizeMb ? `<div class="metric"><span>Tamaño</span><b>${m.sizeMb} MB</b></div>` : ''}${m.note ? `<p class="small muted">${h(m.note)}</p>` : ''}<p class="small muted">Licencia Apache 2.0. Viene incluido en la app: no necesita descarga. Error publicado: 11 a 17 % de palabras, según la prueba.</p></div>
      <div class="card"><h3 style="margin-top:0">Voz del tutor</h3><div class="metric"><span>Motor</span><b>${P.isNative ? 'Android TextToSpeech' : 'Navegador'}</b></div><div class="metric"><span>Voz en español</span><b>${h(t.voice || t.locale || 'No encontrada')}</b></div>${t.ready ? '' : '<p class="small" style="color:var(--warn)">Instala una voz en español en los ajustes de texto a voz de tu teléfono.</p>'}${U.speakBtn('Hola. Esta es una prueba de la voz.', 'Probar')}</div>
      <div class="card"><h3 style="margin-top:0">Inteligencia artificial local</h3><p class="small muted">No está incluida en esta versión. Las conversaciones usan guiones. La IA local solo se agregará si las pruebas en tu teléfono confirman que funciona bien.</p></div>
      <div class="card"><h3 style="margin-top:0">Tu teléfono</h3><div class="metric"><span>Sistema</span><b>${h(d.platform || 'Android')} ${h(d.android)}</b></div><div class="metric"><span>Arquitectura</span><b>${h(d.abi)}</b></div><div class="metric"><span>RAM</span><b>${d.ramMb ? Math.round(d.ramMb) + ' MB' : 'No disponible'}</b></div></div>
      <button class="btn primary block" data-go="bench">Abrir Banco de Pruebas</button>
      ${b.length ? `<h3>Pruebas anteriores</h3>${b.slice(0, 5).map(x => `<div class="card small">${U.fmtDate(x.at)}: ${x.durationSec.toFixed(0)} s de audio, velocidad ${x.rtf == null ? 'no medida' : x.rtf + ' x tiempo real'}, ruido ${x.snrDb} dB, RAM libre ${x.freeMb == null ? '-' : x.freeMb + ' MB'}</div>`).join('')}` : ''}`);
  });
  U.route('bench', () => {
    U.view('Banco de Pruebas', `<p class="muted">Graba 60 segundos hablando normal. Se mide cómo responde tu teléfono real.</p><div id="rec"></div><div id="out"></div>`, () => {
      const before = P.device();
      U.recorder(U.$('#rec'), { prompt: 'Banco de Pruebas', title: 'Banco de Pruebas', kind: 'banco', sec: 60, group: 'bench', noFeedback: true, onTake: (item) => {
        const after = P.device(), r = item.report, a = r.audio;
        const res = { at: Date.now(), durationSec: a ? a.durationSec : 0, snrDb: a ? a.snrDb : 0, words: r.text.words, rtf: after.lastRtf != null ? after.lastRtf : null, freeMb: after.freeMb, battery: [before.battery, after.battery], thermal: after.thermal, engine: item.engine };
        EP.state.benches.unshift(res); EP.save(true);
        const verdict = res.rtf == null ? 'Sin dato de velocidad en esta plataforma.' : res.rtf < 0.7 ? 'El reconocimiento va más rápido que el habla.' : 'El reconocimiento va justo: cierra otras apps para probar de nuevo.';
        U.$('#out').innerHTML = `<div class="card"><h3 style="margin-top:0">Resultado</h3><div class="metric"><span>Audio</span><b>${res.durationSec.toFixed(1)} s</b></div><div class="metric"><span>Palabras reconocidas</span><b>${res.words}</b></div><div class="metric"><span>Costo de reconocimiento</span><b>${res.rtf == null ? 'No medido' : res.rtf + ' × tiempo real'}</b></div><div class="metric"><span>Señal frente a ruido</span><b>${res.snrDb} dB</b></div><div class="metric"><span>RAM libre</span><b>${res.freeMb == null ? 'No disponible' : res.freeMb + ' MB'}</b></div><div class="metric"><span>Batería antes y después</span><b>${before.battery == null ? 'No disponible' : before.battery + ' % → ' + after.battery + ' %'}</b></div><div class="metric"><span>Temperatura del sistema</span><b>${after.thermal == null ? 'No disponible' : after.thermal}</b></div><p class="small">${h(verdict)}</p></div>`;
      } });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
