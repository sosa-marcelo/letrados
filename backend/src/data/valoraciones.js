import { consultar } from '../infra/bd.js';

/**
 * Valoraciones (modulo 5, epica LET-116, RF-25 a RF-27). Solo SQL: quien
 * puede valorar y cuando lo decide `domain/valoraciones.js`.
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * @typedef {object} FilaValoracion
 * @property {string} id
 * @property {string} solicitud_id
 * @property {string} autor_id
 * @property {string} valorado_id
 * @property {number} puntaje
 * @property {string | null} comentario
 * @property {Date} creada_en
 */

const COLUMNAS = 'id, solicitud_id, autor_id, valorado_id, puntaje, comentario, creada_en';

/**
 * Registra una valoracion. El UNIQUE (solicitud_id, autor_id) hace que la
 * segunda de la misma parte falle con el codigo 23505.
 *
 * @param {{ solicitud_id: string | number, autor_id: string | number, valorado_id: string | number, puntaje: number, comentario?: string | null }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaValoracion>}
 */
export async function insertarValoracion(
  { solicitud_id, autor_id, valorado_id, puntaje, comentario = null },
  ejecutar = consultar,
) {
  const { rows } = await ejecutar(
    `INSERT INTO valoraciones (solicitud_id, autor_id, valorado_id, puntaje, comentario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNAS}`,
    [solicitud_id, autor_id, valorado_id, puntaje, comentario],
  );
  return rows[0];
}

/**
 * La valoracion que una parte dejo sobre un intercambio, si la hay.
 *
 * @param {string | number} solicitud_id
 * @param {string | number} autor_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaValoracion | null>}
 */
export async function valoracionDe(solicitud_id, autor_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS} FROM valoraciones WHERE solicitud_id = $1 AND autor_id = $2`,
    [solicitud_id, autor_id],
  );
  return rows[0] ?? null;
}
