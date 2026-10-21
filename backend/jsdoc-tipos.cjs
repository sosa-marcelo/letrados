/**
 * Plugin de JSDoc para el estilo de tipos que usa el proyecto.
 *
 * Los comentarios del backend usan la sintaxis de tipos de TypeScript que
 * entiende el editor (`import('express').RequestHandler`, `{ a?: string }`,
 * funciones flecha), y el parser de JSDoc no la acepta. Antes de parsear cada
 * archivo, este plugin simplifica esas expresiones a algo que JSDoc sí entiende:
 *
 * - `import('modulo').Tipo` -> `Tipo`
 * - tipos con funciones flecha, objetos literales o genéricos complejos -> se
 *   conservan como texto en la descripción y el tipo pasa a `*`.
 *
 * No cambia el código: sólo lo que ve el generador.
 */

const TAG_CON_TIPO = /@(param|returns?|type|typedef|property|prop|throws|template)\s*\{/g;

/** Busca el cierre de la llave que abre en `inicio` (anidadas incluidas). */
function cierreDeLlave(texto, inicio) {
  let profundidad = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === '{') profundidad++;
    else if (texto[i] === '}') {
      profundidad--;
      if (profundidad === 0) return i;
    }
  }
  return -1;
}

function simplificar(tipo) {
  let t = tipo.replace(/import\(['"][^'"]+['"]\)\./g, '');
  const complejo = /=>|\?:|\{|\btypeof\b|\bkeyof\b|\[\s*\w+\s*:/.test(t) || /<\s*\{/.test(t);
  if (complejo) return '*';
  // `Omit<X, 'y'>`, `Record<K, V>`, `ReturnType<...>` -> el primer argumento o Object.
  t = t.replace(/\b(Omit|Pick|Partial|Required|Readonly)<\s*([\w.]+)[^>]*>/g, '$2');
  t = t.replace(/\b(Record|ReturnType|Parameters|Awaited)<[^>]*>/g, 'Object');
  return t;
}

function transformar(fuente) {
  let salida = '';
  let ultimo = 0;
  TAG_CON_TIPO.lastIndex = 0;
  let m;
  while ((m = TAG_CON_TIPO.exec(fuente)) !== null) {
    const abre = m.index + m[0].length - 1;
    const cierra = cierreDeLlave(fuente, abre);
    if (cierra === -1) break;
    const tipo = fuente.slice(abre + 1, cierra).replace(/\s*\n\s*\*\s*/g, ' ');
    salida += fuente.slice(ultimo, abre + 1) + simplificar(tipo);
    ultimo = cierra;
    TAG_CON_TIPO.lastIndex = cierra;
  }
  return salida + fuente.slice(ultimo);
}

exports.handlers = {
  beforeParse(e) {
    e.source = transformar(e.source);
  },
};
