import { consultar } from '../infra/bd.js';

/**
 * Fotos de las publicaciones (RF-14). Una por publicacion. El contenido viaja
 * y se guarda en base64 (TEXT, migracion 006): la conversion desde y hacia
 * bytes la hace el dominio.
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * @typedef {object} FilaFoto
 * @property {string} tipo - image/jpeg, image/png o image/webp.
 * @property {string} contenido - la imagen en base64.
 * @property {Date} subida_en
 */

/**
 * Guarda la foto de una publicacion; si ya tenia una, la reemplaza.
 *
 * @param {string | number} publicacion_id
 * @param {{ tipo: string, contenido: string }} foto - contenido en base64.
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<void>}
 */
export async function guardarFoto(publicacion_id, { tipo, contenido }, ejecutar = consultar) {
  await ejecutar(`DELETE FROM fotos_publicacion WHERE publicacion_id = $1`, [publicacion_id]);
  await ejecutar(
    `INSERT INTO fotos_publicacion (publicacion_id, tipo, contenido) VALUES ($1, $2, $3)`,
    [publicacion_id, tipo, contenido],
  );
}

/**
 * Borra la foto de una publicacion.
 *
 * @param {string | number} publicacion_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<boolean>} si habia una foto.
 */
export async function borrarFoto(publicacion_id, ejecutar = consultar) {
  const { rowCount } = await ejecutar(
    `DELETE FROM fotos_publicacion WHERE publicacion_id = $1`,
    [publicacion_id],
  );
  return rowCount > 0;
}

/**
 * Lee la foto de una publicacion.
 *
 * @param {string | number} publicacion_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaFoto | null>}
 */
export async function leerFoto(publicacion_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT tipo, contenido, subida_en FROM fotos_publicacion WHERE publicacion_id = $1`,
    [publicacion_id],
  );
  return rows[0] ?? null;
}
