(function (root) {
  const EP = root.EP, U = EP.ui, h = U.h, S = EP.srs, A = EP.analysis, P = EP.platform, M = EP.sim;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- Entrenador oral ---------- */
  const COACH_Q = ['¿Cómo explicarías a un cliente por qué debería contratar tus servicios?', '¿Qué es lo que mejor haces en tu trabajo y cómo lo demuestras?', 'Cuéntame un problema que resolviste este mes.', '¿Por qué alguien debería confiar en ti?', '¿Qué aprendiste de tu último error?', 'Explica qué haces, como si hablaras con un niño.', '¿Qué harías para conseguir diez clientes más?', 'Dime una opinión tuya que mucha gente no comparta, y defiéndela.'];
  U.route('coach', (q) => {
    const st = EP.state, recent = st.recordings.filter(r => r.kind === 'entrenador').slice(0, 5);
    const prompt = typeof q === 'string' && q ? q : pick(COACH_Q);
    U.view('', `<h1>Entrenador oral</h1><div class="card"><span class="muted small">Tutor</span><p style="font-size:18px"><b>${h(prompt)}</b></p><div class="row">${U.speakBtn(prompt, 'Escuchar pregunta')}<button class="btn sm" id="other">Otra pregunta</button></div></div><div id="rec"></div>
      ${recent.length ? `<h3>Tus respuestas recientes</h3>${recent.map(r => `<button class="card tap" data-go="recording" data-arg="${r.id}"><span class="grow small">${h(r.prompt || r.title)}<br><span class="muted">${U.fmtDate(r.at)}</span></span></button>`).join('')}` : ''}`, () => {
      U.$('#other').onclick = () => U.go('coach', pick(COACH_Q), true);
      U.recorder(U.$('#rec'), { prompt, title: 'Entrenador oral', kind: 'entrenador', group: prompt, sec: 60, onDone: () => U.go('coach', pick(COACH_Q), true), doneLabel: 'Siguiente pregunta' });
    });
  });

  /* ---------- Vocabulario ---------- */
  const byWord = w => EP.WORDS.find(x => x.w === w) || EP.state.personal.find(x => x.w === w);
  function ensureCard(w) { if (!EP.state.cards[w]) { EP.state.cards[w] = S.newCard(w, Date.now()); EP.save(); } return EP.state.cards[w]; }
  U.route('vocab', (tab) => {
    tab = tab || 'hoy';
    const st = EP.state, today = U.todayList(), due = S.dueCards(st.cards, Date.now()), tabs = [['hoy', 'Hoy'], ['repaso', `Repaso (${due.length})`], ['dic', 'Diccionario'], ['mio', 'Mis palabras']];
    let body = '';
    if (tab === 'hoy') {
      body = today.length ? today.map(w => { const x = byWord(w), c = st.cards[w]; return `<button class="card tap" data-go="word" data-arg="${h(w)}"><span class="grow"><b>${h(w)}</b><br><span class="small muted">${h(x.def)}</span></span><span class="tag ${c ? 'ok' : ''}">${c ? S.STATES[c.state] : 'Nueva'}</span></button>`; }).join('') : '<div class="card"><p>Terminaste las palabras nuevas de este banco. Sigue con repaso o agrega las tuyas en Mis palabras.</p></div>';
    } else if (tab === 'repaso') {
      body = due.length ? `<button class="btn primary block" data-go="review">Repasar ${due.length} palabras</button>` : '<div class="list-empty">No tienes palabras pendientes por hoy.</div>';
      body += `<div class="card"><h3 style="margin-top:0">Tu avance</h3>${S.STATES.slice(1).map((n, i) => `<div class="metric"><span>${n}</span><b>${Object.values(st.cards).filter(c => c.state === i + 1).length}</b></div>`).join('')}<p class="small muted">Una palabra solo se considera dominada si sigue en uso espontáneo 30 días después. Acertar una prueba no alcanza.</p></div>`;
    } else if (tab === 'dic') {
      body = `<input id="q" placeholder="Buscar palabra" aria-label="Buscar palabra"><div class="row" style="margin-top:8px"><button class="chip" id="fav">Favoritas</button><button class="chip" id="pend">Pendientes</button></div><div id="res"></div>`;
    } else {
      body = `<div class="card"><h3 style="margin-top:0">Agregar a mi diccionario</h3><label for="nw">Palabra</label><input id="nw"><label for="nd">Qué significa</label><input id="nd"><label for="ne">Mi ejemplo</label><input id="ne"><button class="btn primary block" id="add" style="margin-top:10px">Guardar palabra</button></div>
        ${st.personal.length ? st.personal.map(x => `<button class="card tap" data-go="word" data-arg="${h(x.w)}"><span class="grow"><b>${h(x.w)}</b><br><span class="small muted">${h(x.def)}</span></span></button>`).join('') : '<div class="list-empty">Aún no has guardado palabras propias.</div>'}`;
    }
    U.view('', `<h1>Vocabulario</h1><div class="row" style="margin-bottom:8px">${tabs.map(t => `<button class="chip ${tab === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>${body}`, () => {
      U.$$('[data-t]').forEach(b => b.onclick = () => U.go('vocab', b.dataset.t, true));
      if (tab === 'dic') {
        let filter = null;
        const draw = () => {
          const q = U.$('#q').value.trim().toLowerCase(), all = EP.WORDS.concat(st.personal);
          let l = all.filter(x => !q || x.w.toLowerCase().includes(q) || x.def.toLowerCase().includes(q));
          if (filter === 'fav') l = l.filter(x => st.cards[x.w] && st.cards[x.w].fav);
          if (filter === 'pend') l = l.filter(x => st.pending.includes(x.w));
          l = l.slice().sort((a, b) => a.w.localeCompare(b.w, 'es'));
          U.$('#res').innerHTML = l.slice(0, 60).map(x => `<button class="card tap" data-go="word" data-arg="${h(x.w)}"><span class="grow"><b>${h(x.w)}</b><br><span class="small muted">${h(x.def)}</span></span></button>`).join('') + (l.length ? '' : '<div class="list-empty">Sin resultados.</div>') + (l.length > 60 ? `<p class="small muted">Se muestran 60 de ${l.length}. Escribe para filtrar.</p>` : '');
          U.wire(U.$('#res'));
        };
        U.$('#q').oninput = draw;
        U.$('#fav').onclick = e => { filter = filter === 'fav' ? null : 'fav'; e.target.classList.toggle('on', filter === 'fav'); U.$('#pend').classList.remove('on'); draw(); };
        U.$('#pend').onclick = e => { filter = filter === 'pend' ? null : 'pend'; e.target.classList.toggle('on', filter === 'pend'); U.$('#fav').classList.remove('on'); draw(); };
        draw();
      }
      if (tab === 'mio') U.$('#add').onclick = () => {
        const w = U.$('#nw').value.trim().toLowerCase(), d = U.$('#nd').value.trim(), e = U.$('#ne').value.trim();
        if (!w || !d) return U.toast('Escribe la palabra y su significado.');
        if (byWord(w)) return U.toast('Esa palabra ya está en tu diccionario.');
        st.personal.push({ w, syl: w, def: d, syn: [], ant: [], daily: e, pro: '', sale: '', speak: `Di una frase en voz alta con "${w}".`, own: true });
        ensureCard(w); EP.save(true); U.go('vocab', 'mio', true);
      };
    });
  });
  U.route('word', (w) => {
    const x = byWord(w); if (!x) return U.back();
    const st = EP.state, c = ensureCard(w), fav = c.fav, pend = st.pending.includes(w);
    const takes = st.recordings.filter(r => r.kind === 'palabra' && r.group === 'word-' + w);
    U.view('Palabra', `<div class="card"><div class="word">${h(x.w)}</div><p class="muted">Pronunciación: ${h(x.syl)}</p><div class="row">${U.speakBtn(x.w, 'Normal')}<button class="btn sm" data-say="${h(x.w)}" data-rate="0.6">Lento</button></div>
      <p style="margin-top:10px">${h(x.def)}</p>
      ${x.syn.length ? `<p class="small"><b>Sinónimos:</b> ${h(x.syn.join(', '))}</p>` : ''}${x.ant.length ? `<p class="small"><b>Antónimos:</b> ${h(x.ant.join(', '))}</p>` : ''}
      ${x.daily ? `<h3>Cotidiano</h3><p class="quote">${h(x.daily)}</p>` : ''}${x.pro ? `<h3>Profesional</h3><p class="quote">${h(x.pro)}</p>` : ''}${x.sale ? `<h3>Comercial</h3><p class="quote">${h(x.sale)}</p>` : ''}
      <div class="row"><button class="chip ${fav ? 'on' : ''}" id="fav">Favorita</button><button class="chip ${pend ? 'on' : ''}" id="pend">Pendiente</button><span class="tag">${S.STATES[c.state]}</span></div></div>
      <h2>Úsala hablando</h2><div class="card"><p><b>${h(x.speak)}</b></p></div><div id="rec"></div>
      ${takes.length ? `<h3>Tus ejemplos grabados</h3>${takes.slice(0, 5).map(r => `<div class="metric"><span class="small">${h(r.text || 'Sin texto')} <br><span class="muted">${U.fmtDate(r.at)}</span></span>${U.playerHtml(r.id)}</div>`).join('')}` : ''}`, () => {
      U.$('#fav').onclick = e => { EP.state.cards[w].fav = !EP.state.cards[w].fav; e.target.classList.toggle('on'); EP.save(); };
      U.$('#pend').onclick = e => { const i = st.pending.indexOf(w); i < 0 ? st.pending.push(w) : st.pending.splice(i, 1); e.target.classList.toggle('on'); EP.save(); };
      U.wirePlayers(U.$('#app'));
      U.recorder(U.$('#rec'), { prompt: x.speak, title: 'Palabra: ' + w, kind: 'palabra', group: 'word-' + w, sec: 20, targetWord: w, noFeedback: true, doneLabel: 'Listo', onDone: () => U.back() });
    });
  });
  U.route('review', () => {
    const q = S.dueCards(EP.state.cards, Date.now()).slice(0, 20); let i = 0, shown = false;
    const draw = () => {
      if (i >= q.length) return U.view('Repaso', `<div class="card"><h3 style="margin-top:0">Repaso terminado</h3><p>Repasaste ${q.length} palabras. Ahora intenta usar una de ellas en una toma real: así cuenta como uso.</p><button class="btn primary block" data-go="coach">Ir al entrenador oral</button></div>`);
      const c = q[i], x = byWord(c.word);
      U.view(`Repaso ${i + 1} de ${q.length}`, `<div class="card" style="text-align:center"><div class="word">${h(c.word)}</div>${U.speakBtn(c.word)}
        <p class="muted" style="margin-top:10px">¿Qué significa? Dilo en voz alta o en tu mente.</p>
        ${shown ? `<p>${h(x.def)}</p>${x.daily ? `<p class="quote" style="text-align:left">${h(x.daily)}</p>` : ''}` : ''}</div>
        ${shown ? `<div class="grid2"><button class="btn" data-q="0">No la recordé</button><button class="btn" data-q="3">Con dificultad</button><button class="btn" data-q="4">Bien</button><button class="btn primary" data-q="5">Fácil</button></div>` : `<button class="btn primary block" id="show">Mostrar respuesta</button>`}`, () => {
        if (!shown) U.$('#show').onclick = () => { shown = true; draw(); };
        else U.$$('[data-q]').forEach(b => b.onclick = () => { EP.state.cards[c.word] = S.review(EP.state.cards[c.word], +b.dataset.q, Date.now()); EP.touchDay(0); EP.save(); i++; shown = false; draw(); });
      });
    };
    if (!q.length) return U.view('Repaso', '<div class="list-empty">No tienes palabras pendientes por hoy.</div>');
    draw();
  });

  /* ---------- Improvisación ---------- */
  U.route('impro', (dur) => {
    const st = EP.state, count = st.recordings.filter(r => r.kind === 'improvisacion').length;
    let diff = st.profile.imDiff || Math.min(4, 1 + Math.floor(count / 8)), sec = +dur || st.profile.imSec || 60;
    const topic = () => pick(EP.TOPICS[diff]);
    let cur = topic();
    const draw = () => {
      U.view('Improvisación', `<div class="card"><p class="small muted">Dificultad</p><div class="row">${[1, 2, 3, 4].map(d => `<button class="chip ${d === diff ? 'on' : ''}" data-d="${d}">${['Básica', 'Media', 'Alta', 'Experta'][d - 1]}</button>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">Duración</p><div class="row">${[30, 60, 120, 180, 300].map(s => `<button class="chip ${s === sec ? 'on' : ''}" data-s="${s}">${s < 60 ? s + ' s' : s / 60 + ' min'}</button>`).join('')}</div></div>
        <div class="hero"><span class="muted small">Tu tema</span><p style="font-size:20px"><b>${h(cur)}</b></p><div class="row"><button class="btn sm" id="new">Otro tema</button>${U.speakBtn(cur, 'Escuchar')}</div></div><div id="rec"></div>
        <details><summary>¿Te bloqueas?</summary><p class="small">Usa Pasado-Presente-Futuro o Problema-Causa-Solución. Di: "Lo primero que pienso es...".</p></details>`, () => {
        U.$$('[data-d]').forEach(b => b.onclick = () => { diff = +b.dataset.d; st.profile.imDiff = diff; cur = topic(); EP.save(); draw(); });
        U.$$('[data-s]').forEach(b => b.onclick = () => { sec = +b.dataset.s; st.profile.imSec = sec; EP.save(); draw(); });
        U.$('#new').onclick = () => { cur = topic(); draw(); };
        U.recorder(U.$('#rec'), { prompt: cur, title: 'Improvisación', kind: 'improvisacion', group: 'impro-' + sec, sec, onDone: () => { cur = topic(); draw(); }, doneLabel: 'Otro tema' });
      });
    };
    draw();
  });

  /* ---------- Simulador ---------- */
  U.simPlayer = function (host, sc, onEnd, ctxText) {
    let st = M.start(sc);
    const draw = () => {
      const log = st.turns.map(t => `<div class="bubble them">${h(t.said)}</div><div class="bubble me">${h(t.answer)}</div>`).join('');
      if (st.ended) {
        const rep = M.report(sc, st);
        EP.state.sims.unshift({ id: sc.id, title: sc.title, commercial: sc.commercial, at: Date.now(), outcome: st.outcome, trust: st.trust, turns: st.turns.length, report: rep, ctx: ctxText || null });
        EP.touchDay(0); EP.save();
        host.innerHTML = `${log}${st.closing ? `<div class="bubble them">${h(st.closing)}</div>` : ''}
          <div class="card"><div class="row between"><h3 style="margin:0">Resultado: ${h(st.outcome)}</h3><span class="tag estimado">Estimado</span></div>
          <p class="small muted">Objetivo: ${h(sc.objective)}</p><p class="small muted">Informe por palabras clave en un guion. No sustituye una conversación real.</p>
          <h3>Fortalezas</h3><ul>${rep.strengths.map(x => `<li>${h(x)}</li>`).join('')}</ul>
          ${rep.errors.length ? `<h3>Errores y oportunidades</h3><ul>${rep.errors.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
          ${Object.keys(rep.dims).map(k => `<div class="metric"><span>${h(k)}</span><b class="small">${h(rep.dims[k])}</b></div>`).join('')}
          <h3>Recomendaciones</h3><ul>${rep.recs.map(x => `<li>${h(x)}</li>`).join('')}</ul>
          ${st.turns.filter(t => t.tip).length ? `<h3>Comentarios del tutor</h3><ul>${st.turns.filter(t => t.tip).map(t => `<li>${h(t.tip)}</li>`).join('')}</ul>` : ''}</div>
          <div id="endBtns"></div>`;
        if (onEnd) onEnd(rep);
        return;
      }
      const node = M.current(sc, st);
      host.innerHTML = `${log}<div class="bubble them">${h(node.say)}</div>${U.speakBtn(node.say, 'Escuchar')}
        <div id="ans"></div><label for="typed">O escribe tu respuesta</label><textarea id="typed" style="min-height:70px"></textarea><button class="btn primary block" id="send">Responder</button>`;
      U.wire(host);
      const send = (txt) => { if (!txt || !txt.trim()) return U.toast('Di o escribe tu respuesta.'); st = M.respond(sc, st, txt); draw(); window.scrollTo(0, document.body.scrollHeight); };
      host.querySelector('#send').onclick = () => send(host.querySelector('#typed').value);
      U.recorder(host.querySelector('#ans'), { prompt: node.say, title: sc.title, kind: 'simulacion', group: 'sim-' + sc.id + '-' + st.node, noFeedback: true, onDone: (item) => send(host.querySelector('#txt') ? host.querySelector('#txt').value : item.text), doneLabel: 'Enviar esta respuesta' });
      if (P.canSpeak() && EP.state.profile.autoSpeak !== false) P.speak(node.say, EP.state.profile.rate);
    };
    draw();
  };
  const simList = (title, items, intro, extra) => U.view(title, `${intro ? `<p class="muted">${h(intro)}</p>` : ''}${extra || ''}${items.map(s => {
    const last = EP.state.sims.find(x => x.id === s.id);
    return `<button class="card tap" data-go="sim" data-arg="${s.id}"><span class="grow"><b>${h(s.title)}</b><br><span class="small muted">${h(s.persona)}</span>${last ? `<br><span class="small gold">Último resultado: ${h(last.outcome)}</span>` : ''}</span></button>`;
  }).join('')}`);
  U.route('conv', () => simList('Conversaciones', EP.SCENARIOS.filter(s => !s.commercial), 'Cada persona tiene un objetivo y reacciona según lo que digas. Son guiones ramificados: no es una conversación libre con IA.'));
  U.route('nego', () => {
    const p = EP.state.products;
    simList('Negociación', EP.SCENARIOS.filter(s => s.commercial), 'Cada cliente te plantea un objetivo comercial concreto.', p.length ? `<div class="card"><p class="small muted">Practicas con: <b>${h(p[0].name)}</b>. Precio: ${h(p[0].price || 'sin definir')}.</p><button class="btn sm" data-go="products">Cambiar productos</button></div>` : `<button class="card tap" data-go="products"><span class="grow small"><b>Agrega tu producto</b><br><span class="muted">Así las simulaciones te recuerdan tu precio y tus beneficios reales.</span></span></button>`);
  });
  U.route('sim', (id) => {
    const sc = EP.SCENARIOS.find(s => s.id === id), p = EP.state.products[0];
    U.view(sc.title, `<div class="card"><p class="small muted">${h(sc.persona)}</p><p><b>Objetivo:</b> ${h(sc.objective)}</p>${sc.commercial && p ? `<p class="small">Hablas de <b>${h(p.name)}</b> · Precio: ${h(p.price || 'sin definir')} · Beneficios: ${h(p.benefits || 'sin definir')}</p>` : ''}</div><div id="simh"></div>`, () => {
      U.simPlayer(U.$('#simh'), sc, () => {
        U.$('#endBtns').innerHTML = `<button class="btn block" id="again">Repetir esta simulación</button>`;
        U.$('#again').onclick = () => U.go('sim', id, true);
      }, sc.commercial && p ? p.name : null);
    });
  });

  /* ---------- Laboratorio de acento ---------- */
  U.route('lab', () => {
    const s = U.levelStatus()[8];
    if (!s.unlocked) return U.view('Laboratorio de acento', `<div class="card" style="text-align:center">${U.icon('lock')}<h3>Bloqueado</h3><p class="muted">Este laboratorio pertenece al nivel 8. Primero aprendes a expresarte y después eliges cómo suena tu voz. Se abre al aprobar los niveles 1 al 7.</p><p>Tu acento colombiano es válido. Aquí sumarás un registro, no reemplazarás el tuyo.</p><button class="btn block" data-go="academy">Ver mi avance</button></div>`);
    let i = 0;
    const draw = () => {
      const it = EP.NEUTRAL[i], refId = 'ref' + i, k = 'lab-' + i;
      const takes = EP.state.recordings.filter(r => r.group === k);
      U.view('Laboratorio de Acento Neutro', `<div class="row">${EP.NEUTRAL.map((n, j) => `<button class="chip ${j === i ? 'on' : ''}" data-i="${j}">${h(n.sound)}</button>`).join('')}</div>
        <div class="hero"><p style="font-size:20px"><b>${h(it.t)}</b></p><div class="row">${U.speakBtn(it.t, 'Referencia')}<button class="btn sm" data-say="${h(it.t)}" data-rate="0.6">Lenta</button></div></div>
        <div id="rec"></div><div id="cmp"></div>
        ${takes.length > 1 ? `<div class="card"><h3 style="margin-top:0">Tu progreso con esta frase</h3><p class="small muted">Compara tu primera y tu última toma.</p><div class="row">${U.playerHtml(takes[takes.length - 1].id, 'Primera')}${U.playerHtml(takes[0].id, 'Última')}</div></div>` : ''}
        <div class="card"><p class="small muted">El parecido compara la subida y bajada del tono con la voz de referencia. No identifica tu acento ni penaliza pronunciaciones regionales.</p></div>
        <h2>Alternativas a regionalismos</h2><div class="card">${EP.REGIONAL.map(r => `<div class="metric"><span>${h(r[0])}</span><b class="small" style="white-space:normal;text-align:right">${h(r[1])}</b></div>`).join('')}</div>`, () => {
        U.$$('[data-i]').forEach(b => b.onclick = () => { i = +b.dataset.i; draw(); });
        U.wirePlayers(U.$('#app'));
        U.recorder(U.$('#rec'), {
          prompt: it.t, title: 'Laboratorio: ' + it.sound, kind: 'laboratorio', group: k, readingText: it.t, noFeedback: true,
          onTake: async (item) => {
            const box = U.$('#cmp'); if (!box) return;
            const mine = item.report.audio && item.report.audio.pitch;
            if (!P.canSynthFile()) { box.innerHTML = '<div class="card small muted">La comparación con la referencia funciona en la app instalada. Aquí puedes escuchar y comparar por oído.</div>'; return; }
            if (!mine) { box.innerHTML = '<div class="card small muted">No hay evidencia suficiente: el tono no se pudo medir en esta toma. Compara por oído.</div>'; return; }
            try {
              const r = await P.synthToFile(refId, it.t, 1); if (!r.ok) throw 0;
              const d = A.decodeWav(await P.getAudio(refId)), m = A.audioMetrics(d.pcm, d.sampleRate), sim = m.pitch ? A.contourSimilarity(mine.contour, m.pitch.contour) : null;
              const el = U.$('#cmp'); if (el) el.innerHTML = `<div class="card"><div class="metric"><span>Parecido de curva de tono</span><span class="row"><b>${sim == null ? 'No medible' : sim + ' %'}</b>${U.tag('medido')}</span></div><div class="row" style="margin-top:6px">${U.playerHtml(refId, 'Referencia')}${U.playerHtml(item.id, 'Mi toma')}</div></div>`, U.wirePlayers(el);
            } catch (e) { const el = U.$('#cmp'); if (el) el.innerHTML = '<div class="card small muted">No se pudo generar la referencia en este teléfono. Compara por oído.</div>'; }
          }
        });
      });
    };
    draw();
  });
})(typeof window !== 'undefined' ? window : globalThis);
