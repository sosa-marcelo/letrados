/**
 * Registrador minimo. Envuelve `console` y, antes de escribir, redacta los
 * campos sensibles de cualquier objeto que se le pase (RNF-01: nunca se registran
 * contrasenas ni tokens).
 */

/** Claves cuyo valor nunca debe aparecer en el log, sin importar la profundidad. */
const CLAVES_SENSIBLES = new Set([
  'contrasena',
  'contrasena_actual',
  'contrasena_nueva',
  'contrasena_hash',
  'password',
  'token',
  'token_hash',
  'authorization',
  'jwt',
  'secreto',
  'jwt_secreto',
]);

const REEMPLAZO = '[redactado]';

/**
 * Devuelve una copia del valor con los campos sensibles enmascarados. No muta el
 * original. Corta a profundidad 6 para no colgarse con estructuras circulares
 * grandes.
 *
 * @param {unknown} valor
 * @param {number} [profundidad]
 * @returns {unknown}
 */
export function redactar(valor, profundidad = 0) {
  if (profundidad > 6 || valor == null || typeof valor !== 'object') {
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor.map((elemento) => redactar(elemento, profundidad + 1));
  }

  const salida = {};
  for (const [clave, contenido] of Object.entries(valor)) {
    salida[clave] = CLAVES_SENSIBLES.has(clave.toLowerCase())
      ? REEMPLAZO
      : redactar(contenido, profundidad + 1);
  }
  return salida;
}

/**
 * @param {...unknown} args
 */
function escribir(nivel, args) {
  const limpios = args.map((a) => redactar(a));
  // eslint-disable-next-line no-console
  console[nivel](...limpios);
}

export const registrador = {
  info: (...args) => escribir('info', args),
  advertencia: (...args) => escribir('warn', args),
  error: (...args) => escribir('error', args),
};

export default registrador;
