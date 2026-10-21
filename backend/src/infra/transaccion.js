import { obtenerCliente } from './bd.js';

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * Corre `trabajo` dentro de una transaccion y le pasa el ejecutor de esa
 * transaccion, para que lo reenvie a las funciones de `data` por el mismo
 * parametro `ejecutar` que ya usan (DISENIO-GENERAL §5).
 *
 * - Sin `ejecutar`: toma un cliente dedicado del pool, abre `BEGIN`, y al final
 *   hace `COMMIT` (o `ROLLBACK` si `trabajo` lanza) y libera el cliente.
 * - Con `ejecutar` (pruebas): abre la transaccion sobre ese mismo ejecutor.
 *
 * @template T
 * @param {(ejecutar: Ejecutor) => Promise<T>} trabajo
 * @param {{ ejecutar?: Ejecutor }} [opciones]
 * @returns {Promise<T>}
 */
export async function enTransaccion(trabajo, { ejecutar } = {}) {
  if (ejecutar) {
    return conBeginCommit(ejecutar, trabajo);
  }

  const cliente = await obtenerCliente();
  try {
    return await conBeginCommit((sql, parametros) => cliente.query(sql, parametros), trabajo);
  } finally {
    cliente.release();
  }
}

/**
 * @template T
 * @param {Ejecutor} ejecutar
 * @param {(ejecutar: Ejecutor) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
async function conBeginCommit(ejecutar, trabajo) {
  await ejecutar('BEGIN');
  try {
    const resultado = await trabajo(ejecutar);
    await ejecutar('COMMIT');
    return resultado;
  } catch (error) {
    await ejecutar('ROLLBACK');
    throw error;
  }
}
