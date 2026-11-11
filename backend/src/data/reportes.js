import { consultar } from '../infra/bd.js';

/**
 * Reportes de inconvenientes sobre intercambios flagueados (RF-24, LET-156).
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * @typedef {object} FilaReporte
 * @property {string} id
 * @property {string} solicitud_id
 * @property {string} autor_id
 * @property {string} autor_nombre
 * @property {string} descripcion
 * @property {Date} creado_en
 */

const SELECT_REPORTE = `
  SELECT r.id, r.solicitud_id, r.autor_id, u.nombre AS autor_nombre, r.descripcion, r.creado_en
    FROM reportes r
    JOIN usuarios u ON u.id = r.autor_id`;

/**
 * Registra un reporte y lo devuelve con el nombre de quien lo hizo.
 *
 * @param {{ solicitud_id: string | number, autor_id: string | number, descripcion: string }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaReporte>}
 */
export async function insertarReporte({ solicitud_id, autor_id, descripcion }, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `INSERT INTO reportes (solicitud_id, autor_id, descripcion) VALUES ($1, $2, $3) RETURNING id`,
    [solicitud_id, autor_id, descripcion],
  );
  const { rows: completo } = await ejecutar(`${SELECT_REPORTE} WHERE r.id = $1`, [rows[0].id]);
  return completo[0];
}

/**
 * Los reportes de varias solicitudes en una sola consulta, del mas viejo al
 * mas nuevo. Para el panel de flagueados, que muestra una pagina entera.
 *
 * @param {Array<string | number>} solicitud_ids
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaReporte[]>}
 */
export async function reportesDeSolicitudes(solicitud_ids, ejecutar = consultar) {
  if (solicitud_ids.length === 0) return [];
  // IN ($1, ...) y no ANY($1): pg-mem no resuelve ANY con un arreglo como parametro.
  const marcas = solicitud_ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await ejecutar(
    `${SELECT_REPORTE} WHERE r.solicitud_id IN (${marcas}) ORDER BY r.creado_en, r.id`,
    solicitud_ids,
  );
  return rows;
}
