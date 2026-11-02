(function (root) {
  const EP = root.EP, U = EP.ui, P = EP.platform;
  async function boot() {
    const saved = await P.loadState();
    EP.state = saved ? Object.assign(EP.defaultState(), saved) : EP.defaultState();
    EP.state.profile = Object.assign(EP.defaultState().profile, EP.state.profile);
    U.applyTheme();
    const sp = document.createElement('div'); sp.className = 'splash';
    sp.innerHTML = `<div class="logo">ELOQUENT PRO<small>ACADEMIA DE COMUNICACIÓN</small></div><div class="brand" style="position:absolute;bottom:32px">${U.BRAND}</div>`;
    document.body.appendChild(sp);
    if (root.speechSynthesis) { try { root.speechSynthesis.getVoices(); } catch (e) {} }
    setTimeout(() => {
      sp.remove();
      if (!EP.state.onboarded) U.go('welcome', null, true);
      else if (EP.state.profile.pin) U.go('pin', null, true);
      else U.go('home', null, true);
    }, root.__EP_FAST ? 10 : 1100);
  }
  boot();
})(typeof window !== 'undefined' ? window : globalThis);
