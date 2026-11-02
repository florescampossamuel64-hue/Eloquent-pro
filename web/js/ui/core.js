(function (root) {
  const EP = root.EP;
  const U = EP.ui = {};
  const S = EP.srs;
  U.BRAND = 'Powered by Korevia';
  U.h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = {
    back: 'M15 5l-7 7 7 7', home: 'M3 11l9-8 9 8M5 10v10h14V10', book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5', mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
    words: 'M4 6h16M4 12h10M4 18h13', chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7', menu: 'M4 7h16M4 12h16M4 17h16', play: 'M7 4l13 8-13 8z', stop: 'M6 6h12v12H6z', sound: 'M4 10v4h3l5 4V6L7 10zM16 9a4 4 0 010 6', lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3', check: 'M5 13l4 4L19 7',
    talk: 'M4 5h16v11H9l-5 4z', deal: 'M3 8l5-3 4 2 4-2 5 3v7l-9 6-9-6z', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3 11v2h6v-2a6 6 0 00-3-11z', wave: 'M3 12h3l3-7 4 14 3-7h5', folder: 'M3 6h6l2 3h10v10H3z', gear: 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3M18 12h3M12 3v3M12 18v3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', box: 'M4 8l8-5 8 5v9l-8 5-8-5zM4 8l8 5 8-5M12 13v9', clock: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4l3 2', cam: 'M3 7h13v10H3zM16 11l5-3v8l-5-3', list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1', flag: 'M5 21V4h13l-3 4 3 4H5', flash: 'M13 2L5 14h6l-1 8 8-12h-6z', test: 'M9 3h6M10 3v6l-5 10a2 2 0 002 2h10a2 2 0 002-2L14 9V3'
  };
  U.icon = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n] || IC.menu}"/></svg>`;
  U.fmtTime = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  U.fmtDate = t => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  U.tag = t => `<span class="tag ${t}">${t === 'autoevaluacion' ? 'Autoevaluación' : t === 'medido' ? 'Medido' : 'Estimado'}</span>`;
  U.$ = s => document.querySelector(s);
  U.$$ = s => Array.from(document.querySelectorAll(s));
  U.toast = function (msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  };
  U.uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Estado ---------- */
  EP.defaultState = () => ({
    v: 1, profile: { name: '', goals: [], minutes: 10, reminder: { on: false, h: 7, m: 0 }, pin: null, theme: 'dark', rate: 1, mode: 'profesor', fillers: EP.analysis.FILLERS.slice() },
    onboarded: false, diagnostic: { step: 0, results: {}, done: false, report: null, at: null }, lessonsDone: {}, attempts: {}, cards: {}, assigned: {}, pending: [], personal: [],
    recordings: [], sessions: [], sims: [], missions: {}, diary: [], products: [], rehearsals: [], benches: [], days: {}, retests: {}
  });
  let timer = null;
  EP.state = null;
  EP.save = function (now) {
    clearTimeout(timer);
    const go = () => EP.platform.saveState(JSON.parse(JSON.stringify(EP.state)));
    if (now) return go();
    timer = setTimeout(go, 200);
  };
  EP.touchDay = function (sec) {
    const k = S.dayKey(); EP.state.days[k] = EP.state.days[k] || { sec: 0, n: 0 };
    EP.state.days[k].sec += sec || 0; EP.state.days[k].n += 1;
  };
  U.applyTheme = () => { document.documentElement.dataset.theme = EP.state.profile.theme === 'light' ? 'light' : 'dark'; };
  U.levelStatus = () => EP.exams.levelStatus(EP.LEVELS, EP.state.attempts);

  /* ---------- Navegación ---------- */
  const routes = {}, stack = [];
  U.route = (name, fn) => { routes[name] = fn; };
  let cleanup = null;
  U.onLeave = fn => { cleanup = fn; };
  const NAV = [['home', 'Inicio', 'home'], ['academy', 'Academia', 'book'], ['coach', 'Entrenar', 'mic'], ['vocab', 'Palabras', 'words'], ['stats', 'Progreso', 'chart']];
  function renderNav(name) {
    const show = EP.state && EP.state.onboarded && !['welcome', 'setup', 'pin'].includes(name);
    U.$('#nav').innerHTML = show ? `<nav class="nav"><div>${NAV.map(n => `<button data-nav="${n[0]}" class="${n[0] === name ? 'on' : ''}">${U.icon(n[2])}<span>${n[1]}</span></button>`).join('')}</div></nav>` : '';
    U.$$('[data-nav]').forEach(b => { b.onclick = () => { stack.length = 0; U.go(b.dataset.nav, null, true); }; });
  }
  let current = null;
  U.go = function (name, arg, replace) {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    EP.platform.stopSpeak();
    if (current && !replace) stack.push(current);
    current = { name, arg };
    window.scrollTo(0, 0);
    renderNav(name);
    (routes[name] || routes.home)(arg);
  };
  U.back = function () {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    EP.platform.stopSpeak();
    const prev = stack.pop();
    if (!prev) { if (current && current.name !== 'home') { current = { name: 'home' }; renderNav('home'); routes.home(); } return; }
    current = prev; window.scrollTo(0, 0); renderNav(prev.name); routes[prev.name](prev.arg);
  };
  U.refresh = () => { if (current) routes[current.name](current.arg); };
  EP.platform.back = U.back;
  /* Pinta la pantalla. data-go y data-say se conectan automáticamente. */
  U.view = function (title, html, bind) {
    const top = title ? `<div class="topbar"><button class="back" id="backBtn" aria-label="Volver">${U.icon('back')}</button><div class="t">${U.h(title)}</div></div>` : '';
    const app = U.$('#app');
    app.innerHTML = top + html;
    if (title) U.$('#backBtn').onclick = U.back;
    U.wire(app);
    if (bind) bind();
  };
  U.wire = function (el) {
    el.querySelectorAll('[data-go]').forEach(b => { if (b.disabled) return; b.onclick = () => { let a = b.dataset.arg; U.go(b.dataset.go, a === undefined ? null : a); }; });
    el.querySelectorAll('[data-say]').forEach(b => { b.onclick = () => EP.platform.speak(b.dataset.say, parseFloat(b.dataset.rate) || EP.state.profile.rate); });
  };
  U.speakBtn = (text, label) => EP.platform.canSpeak() ? `<button class="btn sm" data-say="${U.h(text)}">${U.icon('sound')}${label || 'Escuchar'}</button>` : '';
  /* Gráfica de línea. Sin datos reales no dibuja nada. */
  U.lineChart = function (vals, label, unit) {
    if (vals.length < 2) return `<div class="list-empty">${U.h(label)}: se necesitan al menos 2 tomas válidas.</div>`;
    const W = 320, H = 110, pad = 26, max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
    const x = i => pad + i * (W - pad - 8) / (vals.length - 1), y = v => 12 + (H - 30) * (1 - (v - min) / rng);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<h3>${U.h(label)}</h3><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.h(label)}">
      <line x1="${pad}" x2="${W - 8}" y1="${H - 18}" y2="${H - 18}" stroke="var(--line)"/>
      <text x="0" y="16" font-size="10" fill="var(--muted)">${+max.toFixed(1)}</text><text x="0" y="${H - 20}" font-size="10" fill="var(--muted)">${+min.toFixed(1)}</text>
      <polyline fill="none" stroke="var(--gold)" stroke-width="2" points="${pts}"/>
      ${vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="var(--gold)"/>`).join('')}
      <text x="${pad}" y="${H - 4}" font-size="10" fill="var(--muted)">Primera toma</text><text x="${W - 8}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="end">Última: ${+vals[vals.length - 1].toFixed(1)} ${U.h(unit || '')}</text></svg>`;
  };
  U.brand = () => `<div class="brand">ELOQUENT PRO · ${U.BRAND}</div>`;
})(typeof window !== 'undefined' ? window : globalThis);
