/**
 * Plazo de confirmacion de un intercambio aceptado (RF-22).
 *
 * Hasta la epica LET-115 es un stub de 24 horas: la tarea LET-154 lo lee del
 * parametro `plazo_confirmacion_segundos` de la base, sin cambiar la firma.
 */

/** 24 horas, el plazo habitual. */
export const PLAZO_POR_DEFECTO_SEGUNDOS = 86400;

/**
 * Fecha limite para que las dos partes confirmen un intercambio aceptado.
 *
 * @param {Date} [ahora]
 * @param {{ ejecutar?: Function }} [_opciones]
 * @returns {Promise<Date>}
 */
export async function calcularVencimiento(ahora = new Date(), _opciones = {}) {
  return new Date(ahora.getTime() + PLAZO_POR_DEFECTO_SEGUNDOS * 1000);
}
