import { leerParametro } from '../data/parametros.js';
import { registrador } from '../infra/registrador.js';

/**
 * Plazo de confirmacion de un intercambio aceptado (RF-22, LET-154).
 *
 * El valor vive en la base (`parametros.plazo_confirmacion_segundos`), asi se
 * cambia sin desplegar: 86400 (24 horas) de forma habitual y 10 para la demo.
 * Un valor que no es un entero positivo no rompe la aceptacion: se usa el de
 * 24 horas y queda un aviso en el registro.
 */

/** 24 horas, el plazo habitual. */
export const PLAZO_POR_DEFECTO_SEGUNDOS = 86400;

/** Clave del parametro en la tabla `parametros`. */
export const CLAVE_PLAZO = 'plazo_confirmacion_segundos';

/**
 * Los segundos de plazo configurados, o el defecto si el valor no sirve.
 *
 * @param {{ ejecutar?: import('../data/parametros.js').Ejecutor }} [opciones]
 * @returns {Promise<number>}
 */
export async function segundosDePlazo({ ejecutar } = {}) {
  const valor = await leerParametro(CLAVE_PLAZO, ejecutar);
  const segundos = /^\s*\d+\s*$/.test(valor ?? '') ? Number.parseInt(valor, 10) : NaN;
  if (!Number.isInteger(segundos) || segundos <= 0) {
    registrador.advertencia('Plazo de confirmacion invalido; se usan 24 horas', {
      clave: CLAVE_PLAZO,
      valor,
    });
    return PLAZO_POR_DEFECTO_SEGUNDOS;
  }
  return segundos;
}

/**
 * Fecha limite para que las dos partes confirmen un intercambio aceptado.
 *
 * @param {Date} [ahora]
 * @param {{ ejecutar?: import('../data/parametros.js').Ejecutor }} [opciones]
 * @returns {Promise<Date>}
 */
export async function calcularVencimiento(ahora = new Date(), { ejecutar } = {}) {
  return new Date(ahora.getTime() + (await segundosDePlazo({ ejecutar })) * 1000);
}
