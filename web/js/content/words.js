(function (root) {
  const EP = root.EP = root.EP || {};
  const SPEAK = [
    w => `Di en voz alta una frase de tu día con "${w}".`,
    w => `Explica en 20 segundos un problema real usando "${w}".`,
    w => `Convence a alguien de algo usando "${w}" y una razón.`,
    w => `Cuenta una anécdota breve donde encaje "${w}".`,
    w => `Presenta tu trabajo en dos frases con "${w}".`
  ];
  const seen = new Set();
  EP.WORDS = (EP._wordsRaw || '').trim().split('\n').map(l => l.split('|')).filter(p => {
    if (p.length !== 8 || seen.has(p[0])) return false; seen.add(p[0]); return true;
  }).map((p, i) => ({
    w: p[0], syl: p[1], def: p[2],
    syn: p[3].split(', '), ant: p[4] === '-' ? [] : p[4].split(', '),
    daily: p[5], pro: p[6], sale: p[7], speak: SPEAK[i % SPEAK.length](p[0])
  }));
  /* Mezcla estable y reproducible para no presentar las palabras en orden alfabético. */
  let s = 20261102;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = EP.WORDS.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [EP.WORDS[i], EP.WORDS[j]] = [EP.WORDS[j], EP.WORDS[i]]; }
  delete EP._wordsRaw;
})(typeof window !== 'undefined' ? window : globalThis);
