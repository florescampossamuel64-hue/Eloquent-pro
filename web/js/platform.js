/* Capa de plataforma: Android nativo (Vosk + TextToSpeech) o navegador (versión de prueba). */
(function (root) {
  const EP = root.EP = root.EP || {};
  const N = root.AndroidEP || null;
  const P = EP.platform = { isNative: !!N };
  const listeners = {};
  /* Android llama a EP.native.emit(evento, json) */
  EP.native = { emit(name, json) { let d = json; try { d = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) {} (listeners[name] || []).slice().forEach(f => f(d)); } };
  const on = (n, f) => { (listeners[n] = listeners[n] || []).push(f); return () => { listeners[n] = listeners[n].filter(x => x !== f); }; };
  const once = n => new Promise(r => { const off = on(n, d => { off(); r(d); }); });
  P.on = on;

  /* ---------- Base de datos ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('eloquent', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('audio'); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  const mem = { kv: {}, audio: {} };
  async function idb(store, mode, fn) {
    try {
      const d = await db();
      return await new Promise((res, rej) => { const t = d.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
    } catch (e) { return undefined; }
  }
  P.loadState = async function () {
    let s = await idb('kv', 'readonly', o => o.get('state'));
    if (s === undefined) s = mem.kv.state;
    if (!s && N) { try { const j = N.loadState(); if (j) s = JSON.parse(j); } catch (e) {} }
    return s || null;
  };
  P.saveState = async function (s) {
    mem.kv.state = s;
    await idb('kv', 'readwrite', o => o.put(s, 'state'));
    if (N) { try { N.saveState(JSON.stringify(s)); } catch (e) {} }
  };

  /* ---------- Audio ---------- */
  P.url = id => N ? `/rec/${id}.wav` : null;
  P.getAudio = async function (id) {
    if (N) { const r = await fetch(`/rec/${id}.wav`); if (!r.ok) throw new Error('No se encontró el audio'); return await r.arrayBuffer(); }
    const b = (await idb('audio', 'readonly', o => o.get(id))) || mem.audio[id];
    if (!b) throw new Error('No se encontró el audio');
    return b;
  };
  P.deleteAudio = async function (id) {
    if (N) { N.deleteRec(id); return; }
    delete mem.audio[id]; await idb('audio', 'readwrite', o => o.delete(id));
  };
  P.requestMic = async function () {
    if (N) { if (N.hasMicPermission()) return true; const w = once('micPermission'); N.requestMicPermission(); return (await w).granted; }
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); return true; } catch (e) { return false; }
  };

  let web = null;
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  P.canTranscribe = () => !!N || !!SR;
  P.start = async function (id, onPartial) {
    if (N) {
      const off = on('partial', d => onPartial && onPartial(d.text));
      const r = N.startRecording(id);
      if (r !== 'ok') { off(); throw new Error(r); }
      web = { off };
      N.keepAwake(true);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const Ctx = root.AudioContext || root.webkitAudioContext, ctx = new Ctx();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), chunks = [];
    proc.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ctx.destination);
    let finalText = '', rec = null;
    if (SR) {
      try {
        rec = new SR(); rec.lang = 'es-CO'; rec.continuous = true; rec.interimResults = true;
        rec.onresult = ev => { let i = ''; for (let k = ev.resultIndex; k < ev.results.length; k++) { if (ev.results[k].isFinal) finalText += ev.results[k][0].transcript + ' '; else i += ev.results[k][0].transcript; } onPartial && onPartial(finalText + i); };
        rec.onerror = () => {}; rec.start();
      } catch (e) { rec = null; }
    }
    web = { stream, ctx, proc, src, chunks, id, rate: ctx.sampleRate, rec, getText: () => finalText };
  };
  P.stop = async function () {
    if (N) { const w = once('recDone'); N.stopRecording(); const d = await w; if (web && web.off) web.off(); web = null; N.keepAwake(false); return d; }
    const w = web; web = null;
    if (w.rec) { try { w.rec.stop(); } catch (e) {} await new Promise(r => setTimeout(r, 400)); }
    w.proc.disconnect(); w.src.disconnect(); w.stream.getTracks().forEach(t => t.stop()); await w.ctx.close();
    const len = w.chunks.reduce((s, c) => s + c.length, 0), pcm = new Float32Array(len); let o = 0;
    for (const c of w.chunks) { pcm.set(c, o); o += c.length; }
    /* Reduce a 16 kHz para ocupar poco. */
    const ratio = w.rate / 16000, out = new Float32Array(Math.floor(len / ratio));
    for (let i = 0; i < out.length; i++) out[i] = pcm[Math.floor(i * ratio)];
    const buf = EP.analysis.encodeWav(out, 16000);
    mem.audio[w.id] = buf;
    await idb('audio', 'readwrite', s => s.put(buf, w.id));
    return { id: w.id, text: w.getText().trim(), words: null, durationSec: out.length / 16000, engine: w.rec ? 'Reconocimiento del navegador' : 'Sin transcripción' };
  };

  /* ---------- Voz del tutor ---------- */
  P.canSpeak = () => !!N || !!root.speechSynthesis;
  P.speak = function (text, rate) {
    const r = rate || 1;
    if (N) { const w = once('ttsDone'); N.speak(String(text), r); return w; }
    return new Promise(res => {
      const ss = root.speechSynthesis; if (!ss) return res();
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'es-419'; u.rate = r;
      const v = ss.getVoices().find(x => /^es[-_](419|MX|CO|US)/i.test(x.lang)) || ss.getVoices().find(x => /^es/i.test(x.lang));
      if (v) u.voice = v;
      u.onend = u.onerror = () => res();
      ss.speak(u);
      setTimeout(res, Math.max(4000, String(text).length * 140 / r));
    });
  };
  P.stopSpeak = () => { if (N) N.stopSpeak(); else if (root.speechSynthesis) root.speechSynthesis.cancel(); };
  P.canSynthFile = () => !!N;
  P.synthToFile = async function (id, text, rate) { const w = once('synthDone'); N.synthToFile(id, text, rate || 1); return await w; };

  /* ---------- Sistema ---------- */
  P.device = function () {
    if (N) { try { return JSON.parse(N.deviceInfo()); } catch (e) {} }
    return { platform: 'Navegador', android: '-', abi: '-', ramMb: (navigator.deviceMemory || 0) * 1024, freeMb: null, battery: null, thermal: null };
  };
  P.model = function () {
    if (N) { try { return JSON.parse(N.modelInfo()); } catch (e) {} }
    return { ready: false, name: 'Vosk small-es 0.42', note: 'Disponible solo en la app Android' };
  };
  P.ttsInfo = function () {
    if (N) { try { return JSON.parse(N.ttsInfo()); } catch (e) {} }
    const v = root.speechSynthesis ? root.speechSynthesis.getVoices().filter(x => /^es/i.test(x.lang)) : [];
    return { ready: !!root.speechSynthesis, voice: v[0] ? v[0].name : null, locale: v[0] ? v[0].lang : null };
  };
  P.storage = async function () {
    if (N) { try { return JSON.parse(N.storageInfo()); } catch (e) {} }
    try { const e = await navigator.storage.estimate(); return { bytes: e.usage || 0, free: (e.quota || 0) - (e.usage || 0) }; } catch (e) { return { bytes: 0, free: null }; }
  };
  P.reminder = function (on, h, m) { if (N) { N.setReminder(!!on, h || 0, m || 0); return true; } return false; };
  P.exportBackup = async function (obj) {
    if (N) { const w = once('backupSaved'); N.saveBackup(JSON.stringify(obj)); return await w; }
    if (root.claude && root.claude.use) {
      try {
        const dl = await root.claude.use('downloads');
        if (dl) { await dl.save({ filename: 'eloquent-pro-respaldo.json', data: new Blob([JSON.stringify(obj)], { type: 'application/json' }) }); return { ok: true, note: 'En esta vista previa, el respaldo no incluye audios.' }; }
      } catch (e) { return { ok: false }; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    a.download = 'eloquent-pro-respaldo.json'; a.click(); return { ok: true, note: 'En esta versión de prueba, el respaldo no incluye audios.' };
  };
  P.importBackup = function () {
    if (N) { const w = once('backupLoaded'); N.pickBackup(); return w; }
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
      i.onchange = async () => { if (!i.files[0]) return res({ ok: false }); res({ ok: true, json: await i.files[0].text() }); };
      i.click();
    });
  };
  P.shareRec = async function (id, name) {
    if (N) { N.shareRec(id, name); return true; }
    const buf = await P.getAudio(id), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); a.download = name + '.wav'; a.click(); return true;
  };
  P.back = null;
  EP.native.onBack = () => { if (P.back) P.back(); };
})(typeof window !== 'undefined' ? window : globalThis);
