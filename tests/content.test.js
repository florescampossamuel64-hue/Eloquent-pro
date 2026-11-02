const test = require('node:test'), assert = require('node:assert');
for (const f of ['engine/analysis','content/words1','content/words2','content/words3','content/words','content/levels','content/library','content/scenarios','engine/sim','engine/exams']) require('../web/js/'+f+'.js');
const E = globalThis.EP;
test('300 palabras completas y sin repetir',()=>{
  assert.strictEqual(E.WORDS.length,300);
  for(const w of E.WORDS){for(const k of ['w','syl','def','daily','pro','sale','speak'])assert.ok(w[k],w.w+' '+k);assert.ok(w.syn.length);}
  assert.strictEqual(new Set(E.WORDS.map(w=>w.w)).size,300);
});
test('cada ejemplo usa su palabra',()=>{
  for(const w of E.WORDS)for(const k of ['daily','pro','sale'])assert.ok(E.analysis.usesWord(w[k],w.w),w.w+': '+w[k]);
});
test('8 niveles con lecciones y examen válidos',()=>{
  assert.strictEqual(E.LEVELS.length,8);
  const ids=new Set(E.SCENARIOS.map(s=>s.id));
  const types=['minSeconds','maxBlock','startWithin','structure','reason','closing','connectors','maxFillersPerMin','minVariety','pitchVariation','readingMatch','self'];
  for(const l of E.LEVELS){assert.ok(l.lessons.length>=8);assert.ok(l.exam.length>=2);
    for(const x of l.lessons){assert.ok(x.teach.length&&x.model&&x.prompt&&x.sec);}
    for(const t of l.exam){if(t.sim)assert.ok(ids.has(t.sim),t.sim);for(const c of t.criteria){assert.ok(types.includes(c.type),c.type);assert.ok(c.label);}}}
});
test('escenarios: todos los caminos terminan',()=>{
  assert.ok(E.SCENARIOS.length>=19);
  for(const s of E.SCENARIOS){
    for(const n of Object.keys(s.nodes)){for(const b of s.nodes[n].branches){assert.ok(b.end||s.nodes[b.to],s.id+' '+n);}
      assert.ok(s.nodes[n].branches.some(b=>!b.when),s.id+' '+n+' sin salida por defecto');}
    let st=E.sim.start(s),i=0;while(!st.ended&&i++<10)st=E.sim.respond(s,st,'bla');assert.ok(st.ended,s.id);
    const r=E.sim.report(s,st);assert.ok(r.outcome&&r.strengths.length);
  }
});
test('hay un camino hacia un buen resultado en cada escenario',()=>{
  const TXT={pregunta:'¿Qué le preocupa exactamente de esta situación?',escucha:'Entiendo, si entiendo bien lo que me dice es importante.',valor:'El beneficio es que ahorra tiempo y reduce errores con garantía.',evidencia:'Por ejemplo, un cliente tuvo este resultado que le puedo demostrar.',concesion:'Le propongo una alternativa: si usted confirma, podemos ajustar.',cierre:'¿Le parece si agendamos el siguiente paso para mañana?',opinion:'Creo que sí, porque considero que funciona.',anecdota:'Recuerdo que una vez me pasó algo parecido en mi trabajo.',precio:'El precio es una inversión de mil pesos con pago en cuotas.'};
  for(const s of E.SCENARIOS){
    let st=E.sim.start(s),i=0;
    while(!st.ended&&i++<10){const b=s.nodes[st.node].branches.find(x=>x.when);st=E.sim.respond(s,st,b.when.map(k=>TXT[k]).join(' '));}
    assert.ok(!/sin acuerdo|pendiente/.test(st.outcome),s.id+' termina en '+st.outcome);
  }
});
