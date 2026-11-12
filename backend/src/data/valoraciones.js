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

/**
 * Valoracion recibida, con quien la escribio y el intercambio que la habilito
 * (los dos titulos).
 *
 * @typedef {FilaValoracion & {
 *   autor_nombre: string, solicitado_titulo: string, ofrecido_titulo: string
 * }} FilaValoracionRecibida
 */

/**
 * Las valoraciones que recibio un usuario (RF-27), de la mas nueva a la mas
 * vieja. Una autora dada de baja ya figura como «Cuenta eliminada»: la baja
 * anonimiza el nombre en la fila de usuarios.
 *
 * @param {string | number} valorado_id
 * @param {{ limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: FilaValoracionRecibida[], total: number }>}
 */
export async function valoracionesRecibidas(valorado_id, { limite, desplazamiento }, ejecutar = consultar) {
  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total FROM valoraciones WHERE valorado_id = $1`,
    [valorado_id],
  );
  const { rows } = await ejecutar(
    `SELECT v.id, v.solicitud_id, v.autor_id, v.valorado_id, v.puntaje, v.comentario, v.creada_en,
            u.nombre AS autor_nombre,
            ls.titulo AS solicitado_titulo, lo.titulo AS ofrecido_titulo
       FROM valoraciones v
       JOIN usuarios u ON u.id = v.autor_id
       JOIN solicitudes s ON s.id = v.solicitud_id
       JOIN publicaciones p ON p.id = s.publicacion_id
       JOIN libros ls ON ls.id = p.libro_id
       JOIN libros lo ON lo.id = s.libro_ofrecido_id
      WHERE v.valorado_id = $1
      ORDER BY v.creada_en DESC, v.id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    [valorado_id],
  );
  return { filas: rows, total: conteo[0].total };
}

/**
 * La reputacion (promedio y cantidad de valoraciones) de varios usuarios a la
 * vez, en una sola consulta. Para el perfil publico, Explorar y el detalle de
 * una publicacion.
 *
 * @param {Array<string | number>} usuario_ids
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<Array<{ valorado_id: string, promedio: string, cantidad: number }>>}
 */
export async function reputacionesDeUsuarios(usuario_ids, ejecutar = consultar) {
  if (usuario_ids.length === 0) return [];
  // IN ($1, ...) y no ANY($1): pg-mem no resuelve ANY con un arreglo como parametro.
  const marcas = usuario_ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await ejecutar(
    `SELECT valorado_id, avg(puntaje) AS promedio, count(*)::int AS cantidad
       FROM valoraciones
      WHERE valorado_id IN (${marcas})
      GROUP BY valorado_id`,
    usuario_ids,
  );
  return rows;
}
