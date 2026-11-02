(function (root) {
  const EP = root.EP = root.EP || {};
  EP.TOPICS = {
    1: ['¿Por qué es importante aprender una nueva habilidad?', '¿Qué cambiarías de tu comunidad?', '¿Cuál es tu comida favorita y por qué?', '¿Qué te enseñó tu primer trabajo?', '¿Cómo sería tu día perfecto?', '¿Qué objeto no podrías dejar en casa?', '¿Quién te enseñó algo importante?', '¿Qué lugar recomendarías en tu ciudad?', '¿Qué hábito quieres adoptar este año?', '¿Por qué te gusta tu barrio o por qué no?'],
    2: ['¿Qué diferencia a un buen vendedor de uno excelente?', '¿Por qué algunas personas generan confianza rápidamente?', '¿Qué harías si tuvieras que dirigir una empresa?', '¿Cómo manejarías a un cliente molesto?', '¿Qué aprendiste de un error reciente?', '¿Vale la pena madrugar?', '¿Las redes sociales ayudan o perjudican a un negocio?', '¿Qué hace que un video de YouTube retenga al público?', '¿Es mejor ahorrar o invertir en uno mismo?', '¿Qué haría más segura tu ciudad?'],
    3: ['¿Cómo convencerías a alguien de invertir en una idea?', '¿Debería reducirse la jornada laboral?', '¿La inteligencia artificial quitará o creará trabajos?', '¿El dinero mide el éxito?', '¿Debería ser obligatorio enseñar finanzas en los colegios?', '¿Conviene más un negocio físico o uno digital?', '¿Cuándo se debe renunciar a un proyecto?', '¿Debe un líder ser temido o querido?', '¿Cómo recuperar la confianza de un cliente perdido?', '¿Es ético usar publicidad emocional?'],
    4: ['Defiende una idea con la que no estés de acuerdo.', '¿Qué decisión pública tomarías si fueras alcalde durante un año y por qué?', 'Explica la inflación a un niño de doce años.', '¿Cómo equilibrar calidad y precio en un mercado competitivo?', 'Convence a un inversionista escéptico en un minuto.', '¿Qué significa tener éxito y quién lo define?', '¿La honestidad total ayuda o perjudica en una negociación?', 'Argumenta a favor y en contra de trabajar con familiares.', 'Imagina que tu empresa cometió un error público. ¿Qué dices?', '¿Qué responsabilidad tiene quien crea contenido en internet?']
  };
  EP.TWISTERS = [
    { lv: 1, t: 'Pepe Pecas pica papas con un pico.' }, { lv: 1, t: 'Tres tristes tigres tragaban trigo en un trigal.' }, { lv: 1, t: 'Como poco coco como, poco coco compro.' },
    { lv: 2, t: 'Pablito clavó un clavito. ¿Qué clavito clavó Pablito?' }, { lv: 2, t: 'El cielo está enladrillado. ¿Quién lo desenladrillará? El desenladrillador que lo desenladrille buen desenladrillador será.' }, { lv: 2, t: 'Erre con erre, cigarro; erre con erre, barril. Rápido corren los carros, cargados de azúcar del ferrocarril.' },
    { lv: 3, t: 'Si Pancha plancha con cuatro planchas, ¿con cuántas planchas plancha Pancha?' }, { lv: 3, t: 'Compadre, cómpreme un coco. Compadre, no compro coco, porque como poco coco como, poco coco compro.' }, { lv: 3, t: 'El perro de San Roque no tiene rabo, porque Ramón Ramírez se lo ha robado.' }
  ];
  EP.READINGS = [
    'Una buena presentación empieza mucho antes de hablar. Empieza cuando pensamos en quién nos escucha, qué necesita y qué queremos que haga después. Con esa claridad, cada palabra encuentra su lugar.',
    'Cuando un cliente pregunta por el precio, en realidad quiere saber si la decisión es segura. Por eso, antes de responder con una cifra, conviene explicar qué incluye, qué problema resuelve y cómo puede comprobar el resultado.',
    'Negociar no significa ganarle a la otra persona. Significa encontrar un acuerdo que ambas partes puedan cumplir. Para lograrlo, hay que escuchar con atención, proponer con claridad y saber cuándo decir que no.',
    'Nuestra empresa ofrece un servicio de atención para pequeños negocios en toda la región. En los próximos meses ampliaremos el horario y mejoraremos los tiempos de entrega. Le agradecemos su confianza.'
  ];
  EP.NEUTRAL = [
    { sound: 'S final', t: 'Los clientes satisfechos siempre nos recomiendan a sus amigos.' },
    { sound: 'D final', t: 'Usted verá en la ciudad la verdad de esta oportunidad.' },
    { sound: 'D entre vocales', t: 'El pedido quedó terminado y el resultado fue comprobado.' },
    { sound: 'R y RR', t: 'El proveedor recorrió la carretera para entregar el material.' },
    { sound: 'Terminaciones -ción', t: 'La administración revisó la información de la operación.' },
    { sound: 'Grupos consonánticos', t: 'Instalamos el transporte en la construcción de la empresa.' },
    { sound: 'Entonación afirmativa', t: 'Este plan le conviene. Le muestro por qué.' },
    { sound: 'Entonación de pregunta', t: '¿Tiene alguna duda sobre el contrato?' },
    { sound: 'Ritmo y pausa', t: 'Lo que hace la diferencia no es el precio. Es la confianza.' },
    { sound: 'Narración', t: 'Hace muchos años, en un pequeño pueblo, una mujer decidió empezar de nuevo.' }
  ];
  EP.REGIONAL = [['parce', 'amigo, compañero'], ['bacano', 'excelente, muy bueno'], ['tinto', 'café negro'], ['a la orden', 'con mucho gusto'], ['chévere', 'agradable, interesante'], ['plata', 'dinero'], ['vaina', 'asunto, cosa concreta'], ['mandar', 'enviar'], ['ahorita', 'en un momento (di la hora exacta)'], ['paila', 'mala noticia, no se pudo'], ['camello', 'trabajo'], ['gomelo', 'persona de clase alta'], ['rumba', 'fiesta'], ['pecueca', 'mal olor de pies'], ['guayabo', 'malestar después de beber'], ['carro', 'automóvil o auto (cambia según el país)'], ['celular', 'teléfono móvil'], ['arriendo', 'alquiler, renta'], ['domicilio', 'entrega a domicilio']];
  EP.STRUCTURES = [
    { n: 'Punto-Razón-Ejemplo-Punto', use: 'Opiniones y respuestas rápidas', steps: ['Di tu idea', 'Explica por qué', 'Da un ejemplo real', 'Repite tu idea'], ex: 'Conviene ahorrar. Porque da tranquilidad. Cuando se me dañó la moto, tenía para arreglarla. Por eso conviene ahorrar.' },
    { n: 'Pasado-Presente-Futuro', use: 'Improvisar sobre cualquier tema', steps: ['Cómo era', 'Cómo es', 'Cómo será'], ex: 'Antes comprábamos en la tienda. Hoy pedimos por el celular. Pronto las tiendas nos conocerán mejor.' },
    { n: 'Problema-Solución-Beneficio', use: 'Presentar un producto', steps: ['El problema del cliente', 'Tu solución', 'Lo que gana'], ex: 'Pierde clientes por no responder rápido. Con este sistema responde en minutos. Vende más sin contratar a alguien.' },
    { n: 'Situación-Problema-Implicación-Beneficio', use: 'Preguntas de venta', steps: ['¿Cómo funciona hoy?', '¿Qué dificultad tiene?', '¿Qué le cuesta eso?', '¿Qué ganaría al resolverlo?'], ex: '¿Cómo toma los pedidos? ¿Se le pierden? ¿Cuánto representa? ¿Qué haría con ese dinero?' },
    { n: 'Hecho-Efecto-Necesidad-Propuesta', use: 'Conversaciones difíciles', steps: ['Lo que pasó, sin juzgar', 'Lo que causó', 'Lo que necesitas', 'Lo que propones'], ex: 'Hubo tres retrasos. El cliente se quejó. Necesito cumplir. Propongo salir una hora antes.' },
    { n: 'Historia en cinco partes', use: 'Discursos y videos', steps: ['Persona', 'Deseo', 'Obstáculo', 'Cambio', 'Enseñanza'], ex: 'Mi vecina quería una panadería. Le negaron el crédito. Empezó con diez panes. Hoy tiene dos locales. Empezar pequeño también es empezar.' }
  ];
  EP.RESCUE = [
    { when: 'Te quedas en blanco', p: ['Déjame pensarlo un segundo.', 'Voy a organizar esta idea.', 'Lo diría de otra manera.'] },
    { when: 'Pierdes el hilo', p: ['Retomo lo principal.', 'Lo que quiero decir es esto.', 'Volviendo a mi punto.'] },
    { when: 'No sabes la respuesta', p: ['No tengo ese dato ahora. Lo confirmo y le escribo hoy.', 'Le digo lo que sí sé.', 'Prefiero verificarlo antes de darle una cifra.'] },
    { when: 'No encuentras una palabra', p: ['Es eso que sirve para...', 'Algo parecido a...', 'Te lo explico con un ejemplo.'] },
    { when: 'Te interrumpen', p: ['Entiendo su duda. Termino esta idea y la respondo.', 'Buena pregunta. La tomo enseguida.'] },
    { when: 'Quieres ganar tiempo', p: ['Buena pregunta.', 'Si entiendo bien, me pregunta...', 'Te respondo en dos partes.'] }
  ];
  EP.MISSIONS = [
    'Saluda a alguien que no conoces y hazle una pregunta abierta.', 'Pide en una tienda una recomendación y pregunta por qué.', 'Da tu opinión en una conversación y agrega una razón.', 'Preséntate a un cliente potencial en 20 segundos.', 'Pide una decisión concreta a alguien esta semana.', 'Escucha a alguien durante dos minutos y resume lo que oíste.', 'Cuenta una anécdota en menos de un minuto.', 'Di el precio de tu trabajo sin justificarte y haz una pausa.', 'Discrepa con respeto de una idea y ofrece otra.', 'Llama a un antiguo contacto con una razón útil.', 'Pide retroalimentación concreta sobre cómo comunicas.', 'Graba un video de 30 segundos para tu canal sin leer.'
  ];
  EP.HOOKS = ['Empieza con una pregunta que tu público quiera responder.', 'Empieza con un dato que sorprenda (verifícalo).', 'Empieza con el final: muestra el resultado y luego cuenta cómo pasó.', 'Empieza con un error común: "casi todos hacen esto mal".', 'Empieza con una promesa concreta: "en dos minutos vas a saber...".'];
  EP.VIDEO_TASKS = [
    { n: 'Gancho', sec: 15, tip: 'Una frase clara, sin saludo largo.' },
    { n: 'Introducción', sec: 30, tip: 'Di de qué trata y por qué le sirve a quien mira.' },
    { n: 'Narración', sec: 60, tip: 'Una idea por frase, con pausas.' },
    { n: 'Llamada a la acción', sec: 15, tip: 'Pide una sola acción y dila con claridad.' }
  ];
  EP.CHECKLIST_BODY = ['Pies firmes', 'Hombros relajados', 'Manos visibles', 'Mirada al lente o a las personas', 'Gestos que acompañan la idea'];
  EP.VOCAB_QUIZ = [
    { q: '¿Qué palabra significa "exacto y claro"?', a: 'preciso', o: ['preciso', 'previsto', 'preso'] },
    { q: '"Prever" significa:', a: 'ver con anticipación', o: ['suministrar', 'ver con anticipación', 'repetir'] },
    { q: '"Asequible" significa:', a: 'que se puede conseguir o pagar', o: ['agresivo', 'que se puede conseguir o pagar', 'que no se entiende'] },
    { q: 'Un sinónimo de "persuadir" es:', a: 'convencer', o: ['convencer', 'callar', 'heredar'] },
    { q: 'Lo contrario de "ambiguo" es:', a: 'claro', o: ['claro', 'antiguo', 'dudoso'] },
    { q: '"Aptitud" se refiere a:', a: 'capacidad', o: ['disposición', 'capacidad', 'altura'] }
  ];
  EP.SENTENCE_BUILD = [
    { parts: ['el precio', 'incluye', 'instalación', 'y soporte'], a: 'el precio incluye instalación y soporte' },
    { parts: ['si usted', 'confirma hoy', 'entregamos', 'el lunes'], a: 'si usted confirma hoy entregamos el lunes' },
    { parts: ['aunque', 'cuesta más', 'dura', 'el doble'], a: 'aunque cuesta más dura el doble' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
