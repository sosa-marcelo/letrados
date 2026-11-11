import { consultar } from '../infra/bd.js';

/**
 * Parametros que se cambian sin desplegar (migracion 008). Hoy uno solo: el
 * plazo de confirmacion de un intercambio aceptado (RF-22).
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * El valor de un parametro, como texto, o null si no existe.
 *
 * @param {string} clave
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<string | null>}
 */
export async function leerParametro(clave, ejecutar = consultar) {
  const { rows } = await ejecutar(`SELECT valor FROM parametros WHERE clave = $1`, [clave]);
  return rows[0]?.valor ?? null;
}
