const test = require('node:test'), assert = require('node:assert');
for (const f of ['analysis','srs','exams','sim']) require('../web/js/engine/'+f+'.js');
const { analysis:A, srs:S, exams:X, sim:M } = globalThis.EP;
const RATE=16000;
let seed=7; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296-0.5;};
/* Voz sintética: armónicos con tono variable, segmentos separados por silencio. */
function speech(segs,{noise=0.0015,f0=(t)=>130+25*Math.sin(t*5)}={}){
  const total=segs.reduce((s,x)=>s+x[1],0),pcm=new Float32Array(Math.round(total*RATE));let i=0,ph=0;
  for(const [on,dur] of segs){const n=Math.round(dur*RATE);
    for(let k=0;k<n;k++,i++){const t=i/RATE;ph+=2*Math.PI*f0(t)/RATE;
      pcm[i]=(on?0.25*(Math.sin(ph)+0.5*Math.sin(2*ph)+0.25*Math.sin(3*ph)):0)+noise*rnd()*2;}}
  return pcm;}

test('detecta pausas reales con tiempos correctos',()=>{
  const m=A.audioMetrics(speech([[0,0.5],[1,2],[0,1],[1,2],[0,2.5],[1,1],[0,0.4]]),RATE);
  assert.strictEqual(m.pauseCount,2);
  assert.ok(Math.abs(m.pauses[0].sec-1)<0.1,'pausa 1 '+m.pauses[0].sec);
  assert.ok(Math.abs(m.longestPause-2.5)<0.1);
  assert.ok(Math.abs(m.speakingSec-5)<0.3,'habla '+m.speakingSec);
  assert.ok(Math.abs(m.firstSpeechSec-0.5)<0.1);
  assert.strictEqual(m.noisy,false);
});
test('mide tono y su variación',()=>{
  const flat=A.audioMetrics(speech([[0,0.5],[1,3]],{f0:()=>150}),RATE).pitch;
  assert.ok(Math.abs(flat.medianHz-150)<6,'mediana '+flat.medianHz);
  assert.ok(flat.variationSemis<0.6,'plano '+flat.variationSemis);
  const moved=A.audioMetrics(speech([[0,0.5],[1,3]],{f0:t=>150*Math.pow(2,4*Math.sin(t*3)/12)}),RATE).pitch;
  assert.ok(moved.variationSemis>flat.variationSemis+1.5,'variado '+moved.variationSemis);
});
test('marca ruido alto y no entrega tono',()=>{
  const m=A.audioMetrics(speech([[1,1],[0,1],[1,1]],{noise:0.12}),RATE);
  assert.strictEqual(m.noisy,true); assert.strictEqual(m.pitch,null);
});
test('silencio total queda como inválido',()=>{
  const m=A.audioMetrics(new Float32Array(RATE*2),RATE); assert.strictEqual(m.tooQuiet,true);
});
test('parecido de curvas distingue contornos',()=>{
  const c=f=>A.audioMetrics(speech([[0,0.5],[1,3]],{f0:f}),RATE).pitch.contour;
  const up=t=>120+40*t,down=t=>240-40*t;
  const same=A.contourSimilarity(c(up),c(t=>125+42*t)),diff=A.contourSimilarity(c(up),c(down));
  assert.ok(same>diff+15,`igual ${same}, distinto ${diff}`);
});
test('WAV ida y vuelta',()=>{
  const pcm=speech([[1,0.2]]),d=A.decodeWav(A.encodeWav(pcm,RATE));
  assert.strictEqual(d.sampleRate,RATE); assert.strictEqual(d.pcm.length,pcm.length);
  assert.ok(Math.abs(d.pcm[100]-pcm[100])<1e-3);
});
test('cuenta muletillas, vagas, conectores y repeticiones',()=>{
  const t=A.textMetrics('O sea, este producto es bueno porque ahorra tiempo. O sea, por ejemplo ahorra dinero, ahorra cosas. Sin embargo, en conclusión ahorra.');
  assert.strictEqual(t.fillers['o sea'],2); assert.strictEqual(t.fillers['este'],1);
  assert.ok(t.connectors.causa&&t.connectors.ejemplo&&t.connectors.contraste&&t.connectors.cierre);
  assert.strictEqual(t.connectorTypes,4); assert.ok(t.repeated.some(x=>x.word==='ahorra'));
  assert.strictEqual(t.vague.cosas,1);
});
test('no confunde partes de palabras con muletillas',()=>{
  const t=A.textMetrics('estero bueyes puestos tipografía'); assert.strictEqual(t.fillerTotal,0);
});
test('estructura estimada',()=>{
  const ok=A.structure('Creo que aprender es clave porque abre puertas. Por ejemplo, conseguí un cliente. Por eso sigo estudiando.');
  assert.strictEqual(ok.parts,3);
  assert.strictEqual(A.structure('Me gusta mucho aprender cosas nuevas todos los días').parts,1);
});
test('reconoce palabras conjugadas',()=>{
  assert.ok(A.usesWord('Yo negocié y seguimos negociando','negociar'));
  assert.ok(A.usesWord('Fue una propuesta contundente','contundente'));
  assert.ok(!A.usesWord('Nada que ver aquí','contundente'));
});
test('coincidencia de lectura',()=>{
  assert.strictEqual(A.readingMatch('el perro corre rápido','el perro corre rápido'),100);
  assert.strictEqual(A.readingMatch('uno dos tres cuatro','uno tres'),50);
});
test('la retroalimentación trae las ocho partes y no finge sin datos',()=>{
  const r=A.report({text:'',audio:null,durationSec:10}); const f=A.feedback(r,{});
  for(const k of ['good','improve','repeated','alternatives','organize','better','drill','next']) assert.ok(k in f);
  assert.ok(f.improve[0].includes('No hay transcripción'));
  assert.strictEqual(r.wpm,null); assert.strictEqual(r.fillersPerMin,null);
});
test('palabras por minuto usa solo el tiempo de la intervención',()=>{
  const r=A.report({text:Array(120).fill('palabra').join(' '),audio:{durationSec:70,speakingSec:50,pauseTotal:10,pauses:[],pauseCount:0,longestPause:1}});
  assert.strictEqual(r.wpm,120);
});
test('SM-2 crece, se reinicia y una prueba no domina',()=>{
  const now=Date.now();let c=S.newCard('x',now);
  c=S.review(c,4,now);assert.strictEqual(c.interval,1);assert.strictEqual(c.state,2);
  c=S.review(c,4,now);assert.strictEqual(c.interval,3);
  c=S.review(c,5,now);assert.ok(c.interval>=7);
  const reset=S.review(c,0,now);assert.strictEqual(reset.interval,1);
  for(let i=0;i<20;i++)c=S.review(c,5,now);assert.ok(c.state<3,'prueba sola no sube');
});
test('dominada exige 2 días espontáneos y 30 días',()=>{
  const d=86400000,t=Date.UTC(2026,0,10,12);let c=S.newCard('x',t);
  c=S.markSpontaneous(c,t);assert.strictEqual(c.state,1);
  c=S.markSpontaneous(c,t+1000);assert.strictEqual(c.spontaneousDays.length,1);
  c=S.markSpontaneous(c,t+2*d);assert.strictEqual(c.state,4);
  c=S.markSpontaneous(c,t+31*d);assert.strictEqual(c.state,5);
});
test('cinco palabras al día, estables y sin repetir',()=>{
  const bank=Array.from({length:12},(_,i)=>({w:'p'+i}));
  const asg={};asg.d1=S.todayWords(bank,{},'d1',asg);assert.deepStrictEqual(asg.d1,['p0','p1','p2','p3','p4']);
  assert.deepStrictEqual(S.todayWords(bank,{},'d1',asg),asg.d1);
  asg.d2=S.todayWords(bank,{},'d2',asg);assert.strictEqual(asg.d2[0],'p5');
  asg.d3=S.todayWords(bank,{},'d3',asg);assert.strictEqual(asg.d3.length,2);
  assert.strictEqual(S.todayWords(bank,{},'d4',asg).length,0);
});
test('un nivel exige dos días y el 8 sigue bloqueado',()=>{
  const lv=[1,2,3,4,5,6,7,8].map(id=>({id}));
  const pass=(day)=>({passed:true,day});
  let st=X.levelStatus(lv,{1:[pass('a'),pass('a')]});
  assert.strictEqual(st[1].passed,false);assert.strictEqual(st[2].unlocked,false);
  st=X.levelStatus(lv,{1:[pass('a'),pass('b')]});assert.strictEqual(st[2].unlocked,true);
  const att={};for(let i=1;i<=6;i++)att[i]=[pass('a'),pass('b')];
  st=X.levelStatus(lv,att);assert.strictEqual(st[7].unlocked,true);assert.strictEqual(st[8].unlocked,false);
  att[7]=[pass('a'),pass('b')];assert.strictEqual(X.levelStatus(lv,att)[8].unlocked,true);
});
test('sin transcripción la toma no cuenta como reprobada',()=>{
  const task={criteria:[{type:'structure',value:3,label:'e'}]};
  const r=A.report({text:'',audio:{durationSec:60,speakingSec:50,longestPause:1,pauseTotal:0}});
  const e=X.evaluateTask(task,r,{});assert.strictEqual(e.valid,false);assert.strictEqual(e.passed,false);
});
test('el simulador ramifica, penaliza presión y da informe',()=>{
  const sc={id:'t',commercial:true,objective:'x',start:'a',trustStart:50,nodes:{
    a:{say:'Es caro',branches:[{when:['pregunta'],to:'b',trust:10},{to:'c',trust:-10}]},
    b:{say:'¿Y?',branches:[{when:['cierre'],end:'acuerdo',trust:20,say:'Listo'},{end:'sin acuerdo'}]},
    c:{say:'Adiós',branches:[{end:'sin acuerdo'}]}}};
  let st=M.start(sc);st=M.respond(sc,st,'Entiendo, ¿qué comparó usted para decir que es caro?');
  assert.strictEqual(st.node,'b');assert.strictEqual(st.trust,60);
  st=M.respond(sc,st,'Le parece si agendamos para mañana el siguiente paso');
  assert.ok(st.ended);assert.strictEqual(st.outcome,'acuerdo');
  const rep=M.report(sc,st);assert.ok(rep.strengths.length);
  let st2=M.start(sc);st2=M.respond(sc,st2,'Tiene que comprar ya, es su última oportunidad de hacerlo');
  assert.strictEqual(st2.node,'c');assert.strictEqual(st2.trust,20);
  let st3=M.start(sc);st3=M.respond(sc,st3,'¿Qué?');assert.strictEqual(st3.node,'c');
});

test('sin audio una parte oral no se aprueba ni se reprueba',()=>{
  const task={criteria:[{type:'minSeconds',value:30,label:'t'}]};
  const e=X.evaluateTask(task,A.report({text:'hola mundo',audio:null}),{});
  assert.strictEqual(e.valid,false);assert.strictEqual(e.passed,false);
});
