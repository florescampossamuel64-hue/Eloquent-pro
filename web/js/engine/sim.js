/* Simulador de conversaciones por guiones ramificados. No es conversación libre con IA. */
(function (root) {
  const EP = root.EP = root.EP || {};
  const M = EP.sim = {};
  const A = () => EP.analysis;
  M.INTENTS = {
    pregunta: ['qué', 'cómo', 'cuál', 'cuándo', 'cuánto', 'por qué', 'quién', 'dónde', 'me cuenta', 'cuénteme', 'cuéntame', 'le gustaría', 'te gustaría', 'necesita', 'necesitas'],
    escucha: ['entiendo', 'comprendo', 'tiene razón', 'tienes razón', 'si entiendo bien', 'lo que me dice', 'lo que me dices', 'es decir que', 'gracias por contarme', 'claro'],
    valor: ['beneficio', 'resultado', 'ahorra', 'ahorrar', 'gana', 'ganar', 'aumenta', 'reduce', 'garantía', 'garantizo', 'incluye', 'calidad', 'valor', 'experiencia', 'solución', 'resuelve', 'evita'],
    evidencia: ['por ejemplo', 'un cliente', 'clientes', 'caso', 'resultado', 'por ciento', 'demostrar', 'muestra', 'prueba', 'referencia', 'referencias', 'testimonio'],
    precio: ['precio', 'costo', 'cuesta', 'inversión', 'pesos', 'mil', 'pago', 'cuotas', 'presupuesto', 'financiación'],
    concesion: ['podemos', 'podría', 'propongo', 'te propongo', 'le propongo', 'a cambio', 'si usted', 'si tú', 'opción', 'alternativa', 'acuerdo'],
    cierre: ['empezamos', 'agendamos', 'quedamos', 'siguiente paso', 'próximo paso', 'confirmamos', 'firmamos', 'le parece', 'te parece', 'mañana', 'el lunes', 'esta semana', 'decidir', 'cerramos'],
    presion: ['ahora o nunca', 'última oportunidad', 'tiene que', 'debe comprar', 'no sea', 'se va a arrepentir', 'todos lo compran'],
    saludo: ['hola', 'buenos días', 'buenas tardes', 'mucho gusto', 'me llamo', 'soy', 'un placer'],
    anecdota: ['una vez', 'recuerdo', 'me pasó', 'cuando yo', 'mi experiencia', 'la semana pasada', 'el año pasado'],
    opinion: ['creo que', 'pienso que', 'considero', 'en mi opinión', 'me parece que', 'prefiero', 'porque']
  };
  M.classify = function (text) {
    const raw = String(text || ''), norm = A().tokens(raw).join(' '), found = {};
    for (const k in M.INTENTS) {
      let n = 0;
      for (const p of M.INTENTS[k]) n += A().countPhrase(norm, A().normalize(p));
      if (n) found[k] = n;
    }
    if (raw.includes('?') || raw.includes('¿')) found.pregunta = (found.pregunta || 0) + 1;
    return found;
  };
  M.start = function (sc) { return { id: sc.id, node: sc.start, turns: [], scores: {}, trust: sc.trustStart == null ? 40 : sc.trustStart, ended: false, outcome: null }; };
  M.current = (sc, st) => sc.nodes[st.node];
  /* Elige la rama que coincide con la intención. Si no hay ninguna, usa la salida "otro". */
  M.respond = function (sc, st, text) {
    const node = sc.nodes[st.node], intents = M.classify(text), words = A().tokens(text).length;
    const short = words < 6;
    let branch = null;
    if (!short) for (const b of node.branches) if (b.when && b.when.every(k => intents[k])) { branch = b; break; }
    if (!branch) branch = node.branches.find(b => !b.when) || node.branches[node.branches.length - 1];
    const trust = Math.max(0, Math.min(100, st.trust + (branch.trust || 0) - (intents.presion ? 20 : 0) - (short ? 5 : 0)));
    const scores = Object.assign({}, st.scores);
    for (const k in intents) scores[k] = (scores[k] || 0) + 1;
    const next = Object.assign({}, st, { trust, scores, turns: st.turns.concat([{ node: st.node, said: node.say, answer: text, intents, tip: branch.tip || null }]) });
    if (short) next.shortAnswers = (st.shortAnswers || 0) + 1;
    if (branch.end || !sc.nodes[branch.to]) { next.ended = true; next.outcome = branch.end || (trust >= 60 ? 'bueno' : 'neutro'); next.closing = branch.say || ''; }
    else next.node = branch.to;
    return next;
  };
  /* Informe del guion. Las etiquetas son estimadas: se basan en palabras clave. */
  M.report = function (sc, st) {
    const s = st.scores, turns = st.turns.length || 1, lvl = (n, a, b) => n >= b ? 'Se notó varias veces' : n >= a ? 'Apareció' : 'Casi no apareció';
    const strengths = [], errors = [], recs = [];
    if ((s.pregunta || 0) >= 2) strengths.push('Hiciste preguntas para entender a la otra persona.');
    else errors.push('Preguntaste poco. Antes de proponer, haz al menos dos preguntas.');
    if ((s.escucha || 0) >= 1) strengths.push('Mostraste escucha antes de responder.');
    else errors.push('No reconociste lo que te dijo. Empieza con "si entiendo bien...".');
    if (s.evidencia) strengths.push('Apoyaste tu propuesta con evidencia.');
    if (s.presion) errors.push('Usaste presión. Una persuasión ética da información y deja decidir.');
    if ((st.shortAnswers || 0) >= 2) errors.push('Varias respuestas fueron muy cortas. Desarrolla cada idea con una razón.');
    if (sc.commercial) {
      if (!s.cierre) errors.push('No pediste una decisión ni dejaste un siguiente paso concreto.');
      else strengths.push('Definiste un siguiente paso.');
      if (s.precio && !s.valor) errors.push('Hablaste de precio sin conectarlo con valor.');
      recs.push('Repite esta simulación usando esta secuencia: pregunta, resume, valor con evidencia y siguiente paso con fecha.');
    } else recs.push('Repite con la misma persona y agrega una anécdota breve o una pregunta de seguimiento.');
    if (!strengths.length) strengths.push('Completaste la conversación. Compara tu próxima toma con esta.');
    return {
      outcome: st.outcome, objective: sc.objective, trust: st.trust, strengths, errors, recs,
      dims: {
        'Claridad': lvl((s.valor || 0) + (s.opinion || 0), 1, 3), 'Argumentación': lvl((s.evidencia || 0) + (s.opinion || 0), 1, 2),
        'Escucha': lvl(s.escucha || 0, 1, 2), 'Preguntas': lvl(s.pregunta || 0, 1, 3),
        'Persuasión ética': s.presion ? 'Hubo presión' : lvl((s.valor || 0) + (s.evidencia || 0), 1, 3),
        'Siguiente paso': lvl(s.cierre || 0, 1, 2)
      }, turns
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
