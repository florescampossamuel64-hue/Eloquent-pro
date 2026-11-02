/* Recorrido completo en Chromium a tamaño de teléfono, con micrófono simulado.
   Uso: node tests/e2e.js <voz.wav> <carpeta capturas> [native] */
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const [wav, shots, modeArg] = process.argv.slice(2), NATIVE = modeArg === 'native';
const root = path.join(__dirname, '..', 'web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, s) => { const p = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); } }); });
const fails = [], ok = m => console.log('  ok', m), check = (c, m) => { if (c) ok(m); else { fails.push(m); console.log('  FALLA', m); } };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'es-CO', permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { window.__EP_FAST = true; });
  if (NATIVE) {
    const wavB = fs.readFileSync(wav).toString('base64');
    await page.route('**/rec/*.wav', async route => { await route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(global.__wav16, 'base64') }); });
    global.__wav16 = fs.readFileSync(wav.replace('voz.wav', 'voz16.wav')).toString('base64');
    await page.addInitScript(() => {
      const calls = window.__calls = [];
      const em = (n, d) => setTimeout(() => EP.native.emit(n, JSON.stringify(d)), 30);
      let cur = null, st = '';
      window.AndroidEP = {
        loadState: () => st, saveState: s => { st = s; }, hasMicPermission: () => false, requestMicPermission: () => em('micPermission', { granted: true }),
        startRecording: id => { calls.push('start'); cur = id; em('partial', { text: 'hola parcial' }); return 'ok'; },
        stopRecording: () => { calls.push('stop'); em('recDone', { id: cur, text: 'Creo que practicar ayuda porque mejora. Por ejemplo, ayer mejoré. Por eso sigo.', words: [{ word: 'creo', start: 0, end: 0.3 }], durationSec: 8, engine: 'Vosk small-es 0.42' }); },
        keepAwake: () => {}, modelInfo: () => JSON.stringify({ name: 'Vosk small-es 0.42', ready: true, sizeMb: 39 }), deleteRec: id => calls.push('del:' + id),
        speak: () => em('ttsDone', { ok: true }), stopSpeak: () => {}, synthToFile: () => em('synthDone', { ok: true }), ttsInfo: () => JSON.stringify({ ready: true, voice: 'es-co-x', locale: 'es_CO' }),
        deviceInfo: () => JSON.stringify({ platform: 'Android', android: '15', abi: 'arm64-v8a', ramMb: 7600, freeMb: 3000, battery: 80, thermal: 'Normal', lastRtf: 0.2 }), storageInfo: () => JSON.stringify({ bytes: 1000, free: 1e9 }),
        setReminder: (...a) => calls.push('rem:' + a.join()), saveBackup: () => em('backupSaved', { ok: true }), pickBackup: () => em('backupLoaded', { ok: false }), shareRec: () => calls.push('share')
      };
    });
  }
  const shot = n => page.screenshot({ path: path.join(shots, (NATIVE ? 'n_' : '') + n + '.png') });
  const wait = ms => page.waitForTimeout(ms);
  const tap = async s => { await page.locator(s).first().click(); await wait(60); };
  const text = () => page.locator('#app').innerText();
  const noOverflow = async n => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(o <= 0, `sin desborde horizontal: ${n} (${o})`); };
  const record = async (ms = 1400) => { await tap('#recBtn'); await wait(ms); await tap('#recBtn'); await page.waitForSelector('#txt', { timeout: 15000 }); };

  await page.goto(url); await page.waitForSelector('text=Empezar'); await shot('01_bienvenida'); await noOverflow('bienvenida');
  await tap('text=Empezar'); await shot('02_config');
  await tap('#ok'); check((await page.locator('.toast').count()) > 0, 'exige nombre');
  await page.fill('#n', 'Samuel'); await tap('[data-g]'); await tap('#mic'); await wait(100); await tap('#ok'); await page.waitForSelector('text=Prueba 1 de 8');
  await shot('03_diagnostico');
  for (let i = 0; i < 4; i++) {
    await record(); if (i === 0) { await shot('04_resultado'); await noOverflow('resultado'); }
    const body = await text(); check(/Lo que hiciste bien/.test(body) && /Tu siguiente práctica/.test(body), 'retroalimentación de 8 partes');
    await page.fill('#txt', 'Creo que este negocio mejora porque atiende bien. Por ejemplo, ayer un cliente volvió. Sin embargo falta publicidad. Por eso, en conclusión, hay que seguir.'); await tap('#recalc'); await wait(500);
    check(/Estructura/.test(await text()), 'recalcula con transcripción corregida'); await tap('#doneBtn'); await wait(200);
  }
  for (let i = 0; i < 6; i++) { await tap('[data-o]'); await wait(40); } await wait(150);
  for (let i = 0; i < 3; i++) { const n = await page.locator('[data-k]').count(); for (let k = 0; k < n; k++) await page.locator('[data-k]').nth(k).click(); await wait(600); }
  await record(); await page.fill('#txt', 'La confianza no aparece de un día para otro.'); await tap('#recalc'); await wait(400); await tap('#doneBtn'); await wait(150);
  await record(); await page.fill('#txt', 'Entiendo su duda. El servicio vale porque le ahorra tiempo. Por ejemplo, un cliente ahorró dos horas. ¿Le parece si empezamos?'); await tap('#recalc'); await wait(400); await tap('#doneBtn');
  await page.waitForSelector('text=Tu informe inicial'); await shot('05_informe'); const rep = await text(); check(/Nivel estimado/.test(rep) && /plan inicial/.test(rep) && /Medido|Estimado/.test(rep), 'informe inicial completo');
  await tap('text=Ir a mi panel'); await page.waitForSelector('text=Entrenar ahora'); await shot('06_panel'); await noOverflow('panel');
  check(/Powered by Korevia/.test(await text()), 'marca Powered by Korevia');

  /* Cada herramienta del panel abre sin error */
  const tools = await page.locator('.grid2 [data-go]').evaluateAll(l => l.map(x => x.dataset.go));
  for (const t of tools) { await page.evaluate(n => EP.ui.go(n), t); await wait(120); await shot('t_' + t); await noOverflow(t); await page.evaluate(() => EP.ui.go('home', null, true)); await wait(30); }
  check(tools.length === 17, 'panel con 17 herramientas');
  for (const n of ['academy', 'coach', 'vocab', 'stats']) { await tap(`[data-nav=${n}]`); await wait(120); await shot('nav_' + n); await noOverflow(n); }

  /* Sesión de un toque y modo calle */
  await tap('[data-nav=home]'); await tap('#start'); await wait(100); check((await page.locator('[data-i]').count()) >= 1, 'sesión con pasos'); await shot('07_sesion');
  await tap('[data-nav=home]'); await tap('#street'); await wait(100); check(/Las pruebas orales/.test(await text()), 'modo calle sin voz'); await tap('[data-i]'); await wait(100); await tap('[data-nav=home]');

  /* Academia: bloqueo, lección y examen */
  await tap('[data-nav=academy]'); await tap('[data-locked="8"]'); check(/nivel 8/i.test(await page.locator('.toast').first().innerText()), 'nivel 8 bloqueado');
  await page.evaluate(() => EP.ui.go('level', '8')); await wait(120); check(!/Laboratorio de Acento Neutro/.test(await text()), 'no abre nivel 8 por ruta');
  await page.evaluate(() => EP.ui.go('lab')); await wait(100); check(/Bloqueado/.test(await text()), 'laboratorio bloqueado'); await shot('08_lab_bloqueado');
  await page.evaluate(() => EP.ui.go('level', '1')); await wait(100); check(await page.locator('text=Faltan 10 lecciones').count() === 1, 'examen pide lecciones');
  await tap('[data-go=lesson]'); await wait(100); await shot('09_leccion'); await noOverflow('lección'); await record(); await tap('#doneBtn'); await wait(100); check(await page.locator('text=Faltan 9 lecciones').count() === 1, 'lección completada');
  await page.evaluate(() => { for (let i = 0; i < 10; i++) EP.state.lessonsDone['1-' + i] = 'x'; EP.ui.go('exam', 1); }); await wait(100); await shot('10_examen');
  await record(); await page.fill('#txt', 'Hoy.'); await tap('#recalc'); await wait(400); await tap('#doneBtn'); await wait(150);
  await record(); await page.fill('#txt', 'Cambiaría de trabajo porque quiero crecer.'); await tap('#recalc'); await wait(400); await tap('#doneBtn'); await wait(250); const ex = await text();
  check(/Aún no/.test(ex) && /Ejercicios correctivos/.test(ex), 'examen reprobado con ejercicios correctivos'); await shot('11_informe_examen');
  const lv2 = await page.evaluate(() => EP.ui.levelStatus()[2].unlocked); check(!lv2, 'reprobar no desbloquea');
  await page.evaluate(() => { EP.state.attempts[1] = [{ passed: true, day: 'a', at: 1 }]; }); check(!(await page.evaluate(() => EP.ui.levelStatus()[2].unlocked)), 'un solo día no desbloquea');

  /* Vocabulario */
  await page.evaluate(() => EP.ui.go('vocab')); await wait(100); const nW = await page.locator('[data-go=word]').count(); check(nW === 5, 'cinco palabras hoy'); await tap('[data-go=word]'); await wait(100); await shot('12_palabra'); await noOverflow('palabra');
  check(/Cotidiano/.test(await text()) && /Profesional/.test(await text()) && /Comercial/.test(await text()), 'palabra con tres ejemplos'); await tap('#fav'); await tap('#pend');
  const w = await page.locator('.word').innerText();
  await record(); await page.fill('#txt', `Hoy quiero usar ${w} en una frase.`); await tap('#recalc'); await wait(400);
  await page.evaluate(() => EP.ui.go('vocab', 'dic')); await wait(100); await page.fill('#q', 'negociar'); await wait(100); check((await page.locator('#res [data-go=word]').count()) >= 1, 'búsqueda en diccionario'); await tap('#fav'); await wait(60); check((await page.locator('#res [data-go=word]').count()) >= 0, 'filtro favoritas'); await shot('13_diccionario');
  await page.evaluate(() => EP.ui.go('vocab', 'mio')); await wait(80); await page.fill('#nw', 'dilucidar'); await page.fill('#nd', 'Aclarar algo'); await page.fill('#ne', 'Quiero dilucidar el tema'); await tap('#add'); await wait(100); check(/dilucidar/.test(await text()), 'palabra personal');
  await page.evaluate(() => { const c = EP.state.cards; Object.values(c).forEach(x => x.due = 0); EP.ui.go('review'); }); await wait(100); await tap('#show'); await wait(60); await shot('14_repaso'); await tap('[data-q="4"]'); await wait(60);
  const before = await page.evaluate(() => Object.values(EP.state.cards).filter(c => c.state >= 3).length);

  /* Improvisación, entrenador, simulación */
  await page.evaluate(() => EP.ui.go('impro')); await wait(100); await tap('[data-d="3"]'); await tap('[data-s="30"]'); await tap('#new'); await shot('15_impro'); await record(); await tap('#doneBtn'); await wait(100);
  await page.evaluate(() => EP.ui.go('coach')); await wait(100); await tap('#other'); await wait(80); await record(); await tap('#again'); await wait(50); await record(); check(/Comparación con tu toma anterior/.test(await text()), 'repetir y mejorar compara tomas'); await shot('16_comparar');
  await page.evaluate(() => EP.ui.go('sim', 'caro')); await wait(150); await shot('17_sim'); await noOverflow('simulación');
  for (const t of ['¿Con qué lo está comparando para decir que es caro? ¿Qué le preocupa?', 'El beneficio es que incluye garantía y le ahorra tiempo, ese es su valor.', 'Le propongo una alternativa: si usted paga al inicio, podemos quitar la instalación.']) { if (await page.locator('#typed').count()) { await page.fill('#typed', t); await tap('#send'); await wait(150); } }
  check(/Resultado:/.test(await text()), 'simulación con informe'); await shot('18_sim_informe'); await tap('#again'); await wait(100);
  await page.fill('#typed', 'Se va a arrepentir, tiene que comprar ya, última oportunidad'); await tap('#send'); await wait(100); check((await page.evaluate(() => EP.state.sims.length)) >= 1, 'simulación guardada');
  await page.evaluate(() => { EP.state.products.push({ name: 'Plan Tienda', price: '100 mil' }); EP.ui.go('nego'); }); await wait(100); check(/Plan Tienda/.test(await text()), 'negociación usa mi producto'); await shot('19_nego');

  /* Laboratorio desbloqueado solo al aprobar 1 a 7 */
  await page.evaluate(() => { for (let i = 1; i <= 7; i++) EP.state.attempts[i] = [{ passed: true, day: 'a', at: 1 }, { passed: true, day: 'b', at: 2 }]; EP.ui.go('lab'); }); await wait(120); await shot('20_lab'); check(/Laboratorio de Acento|Referencia/.test(await text()), 'laboratorio abre tras nivel 7'); await tap('[data-i="2"]'); await wait(80); await record(); await wait(600); if (NATIVE) check(/Parecido de curva/.test(await text()), 'compara curva con referencia'); await noOverflow('lab');

  /* Grabaciones y estadísticas con datos reales */
  await page.evaluate(() => EP.ui.go('recordings')); await wait(200); await shot('21_grabaciones'); await page.locator('[data-go=recording]').first().click(); await wait(150); await shot('22_grabacion');
  await page.fill('#nm', 'Mi toma'); await page.locator('#nm').blur(); await wait(50); await tap('[data-play]'); await wait(200); await tap('#exp'); await wait(150);
  if (await page.locator('#cmpSel').count()) { await page.selectOption('#cmpSel', { index: 1 }); await wait(80); }
  await tap('#del'); await tap('#cy'); await wait(150); check(/Audio borrado/.test(await text()), 'eliminar audio');
  await page.evaluate(() => EP.ui.go('stats')); await wait(150); await shot('23_stats'); const stx = await text(); check(/Nivel actual/.test(stx) && /Días de práctica/.test(stx), 'panel de progreso');
  await page.evaluate(() => EP.ui.go('history')); await wait(120); check((await page.locator('.card').count()) > 3, 'historial con eventos');

  /* Responder por escrito */
  await page.evaluate(() => EP.ui.go('coach')); await wait(80); await tap('#typeBtn'); await wait(50); await tap('#wrOk'); await page.fill('#wr', 'Creo que me deben contratar porque cumplo. Por ejemplo, entrego a tiempo. Por eso funciona.'); await tap('#wrOk'); await wait(300); check(/Sin audio/.test(await text()) && /Lo que hiciste bien/.test(await text()), 'respuesta escrita evaluada sin audio');
  /* Otras herramientas */
  await page.evaluate(() => EP.ui.go('before')); await wait(60); await tap('#go'); await wait(1200); check(/00:5\d/.test(await page.locator('#tm').innerText()), 'cuenta regresiva');
  await page.evaluate(() => EP.ui.go('rehearsal')); await wait(60); await page.fill('#a', 'Don Luis'); await page.fill('#b', 'Cerrar un contrato'); await page.fill('#c', 'Está muy caro'); await tap('#mk'); await wait(100); await record(); await tap('#doneBtn'); await wait(80); await shot('24_ensayo'); check(/Paso 2 de 4/.test(await text()), 'ensayo por pasos');
  await page.evaluate(() => EP.ui.go('video')); await wait(80); await page.fill('#sc', 'Hola, hoy te muestro algo nuevo. '.repeat(30)); await tap('#pr'); await wait(800); check(await page.locator('#pt').evaluate(e => e.scrollTop > 0), 'teleprompter se mueve'); await shot('25_video'); await tap('[data-t="Narración"]'); await wait(60);
  await page.evaluate(() => EP.ui.go('missions')); await wait(80); await page.fill('#a', 'Saludé'); await tap('#sv'); await wait(80); check(/Saludé/.test(await text()), 'diario guarda');
  await page.evaluate(() => EP.ui.go('products')); await wait(60); await page.fill('#a', 'Otro'); await tap('#add'); await wait(80); await tap('[data-main="1"]'); await wait(60); await tap('[data-del="1"]'); await wait(60);
  await page.evaluate(() => EP.ui.go('profile')); await wait(60); await tap('#sv');
  await page.evaluate(() => EP.ui.go('settings')); await wait(80); await shot('26_config'); await noOverflow('config'); await tap('[data-th=light]'); await wait(80); await shot('27_claro'); await tap('[data-th=dark]'); await wait(60); await tap('[data-m=entrenador]'); await wait(60); await page.locator('#rem').check(); await wait(60);
  await page.evaluate(() => EP.ui.go('lesson', '1-1')); await wait(80); check(await page.locator('details').count() >= 1, 'modo entrenador oculta explicación');
  await page.evaluate(() => { EP.state.profile.mode = 'profesor'; EP.ui.go('settings'); }); await wait(60); await tap('#exp'); await wait(200);
  await tap('#pin'); await wait(60); for (const d of ['1','2','3','4','ok','1','2','3','4','ok']) { await tap(`[data-k="${d}"]`); await wait(30); } await wait(200); check(await page.evaluate(() => !!EP.state.profile.pin), 'crear PIN');
  await page.evaluate(() => EP.ui.go('pin')); await wait(60); for (const d of ['9','9','9','9','ok']) { await tap(`[data-k="${d}"]`); await wait(30); } await wait(150); check(/incorrecto/.test(await text()), 'PIN incorrecto rechazado'); await shot('28_pin');
  for (const d of ['1','2','3','4','ok']) { await tap(`[data-k="${d}"]`); await wait(30); } await wait(150); check(/Entrenar ahora/.test(await text()), 'PIN correcto entra');
  await page.evaluate(() => { EP.state.profile.pin = null; EP.ui.go('models'); }); await wait(100); await shot('29_modelos'); await tap('text=Abrir Banco de Pruebas'); await wait(100); await record(); await wait(100); check(/Costo de reconocimiento/.test(await text()), 'Banco de Pruebas mide'); await shot('30_banco'); await noOverflow('banco');

  if (NATIVE) { const calls = await page.evaluate(() => window.__calls || []); check(calls.includes('start') && calls.includes('stop'), 'usa puente nativo'); check(calls.some(c => c.startsWith('del:')), 'borra por puente'); check(calls.some(c => c.startsWith('rem:')), 'recordatorio por puente'); check(calls.includes('share'), 'exporta por puente'); }
  /* Persistencia: al recargar conserva todo */
  await page.evaluate(() => EP.save(true)); await wait(300); const recs = await page.evaluate(() => EP.state.recordings.length);
  await page.reload(); await page.waitForSelector('text=Entrenar ahora'); check((await page.evaluate(() => EP.state.recordings.length)) === recs, `conserva ${recs} grabaciones al recargar`);

  /* Botones inertes en todas las rutas */
  console.log('errores de consola:', errs.length, errs.slice(0, 6));
  check(errs.length === 0, 'sin errores de JavaScript');
  await page.evaluate(() => EP.ui.go('settings')); await wait(60); await tap('#wipe'); await tap('#cy'); await wait(300); check(await page.locator('text=Empezar').count() > 0, 'borrar todo vuelve a bienvenida');
  await b.close(); srv.close();
  console.log(fails.length ? `\nFALLAS: ${fails.length}\n- ` + fails.join('\n- ') : '\nTODO BIEN'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
