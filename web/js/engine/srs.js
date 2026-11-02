/* Repetición espaciada SM-2 y estados de dominio de cada palabra. */
(function (root) {
  const EP = root.EP = root.EP || {};
  const S = EP.srs = {};
  const DAY = 86400000;
  S.dayKey = d => { const x = new Date(d == null ? Date.now() : d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  S.STATES = ['Nueva', 'Vista', 'Reconocida', 'Usada en ejercicio', 'Usada espontáneamente', 'Dominada'];
  S.newCard = (word, now) => ({ word, ef: 2.5, reps: 0, interval: 0, due: now, state: 1, seenAt: now, guidedUses: 0, spontaneousDays: [], firstSpontaneous: null, lastUse: null, fav: false });
  /* quality: 0 no la recordé, 3 con dificultad, 4 bien, 5 fácil */
  S.review = function (card, q, now) {
    const c = Object.assign({}, card);
    if (q < 3) { c.reps = 0; c.interval = 1; }
    else {
      c.reps += 1;
      c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.interval * c.ef);
    }
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    c.due = now + c.interval * DAY;
    if (q >= 3 && c.state < 2) c.state = 2;
    return c;
  };
  /* Una prueba de opción múltiple nunca hace dominar una palabra. */
  S.markGuided = function (card, now) {
    const c = Object.assign({}, card);
    c.guidedUses = (c.guidedUses || 0) + 1; c.lastUse = now;
    if (c.state < 3) c.state = 3;
    return c;
  };
  S.markSpontaneous = function (card, now) {
    const c = Object.assign({}, card), key = S.dayKey(now);
    c.spontaneousDays = (c.spontaneousDays || []).slice();
    if (!c.spontaneousDays.includes(key)) c.spontaneousDays.push(key);
    if (!c.firstSpontaneous) c.firstSpontaneous = now;
    c.lastUse = now;
    if (c.spontaneousDays.length >= 2 && c.state < 4) c.state = 4;
    if (c.state >= 4 && now - c.firstSpontaneous >= 30 * DAY) c.state = 5;
    return c;
  };
  S.dueCards = (cards, now) => Object.values(cards).filter(c => c.due <= now).sort((a, b) => a.due - b.due);
  /* Palabras nuevas: 5 por día, en orden fijo, sin repetir. */
  S.todayWords = function (bank, cards, day, assigned) {
    if (assigned[day]) return assigned[day];
    const used = new Set(Object.keys(cards));
    Object.values(assigned).forEach(l => l.forEach(w => used.add(w)));
    return bank.filter(w => !used.has(w.w)).slice(0, 5).map(w => w.w);
  };
})(typeof window !== 'undefined' ? window : globalThis);
