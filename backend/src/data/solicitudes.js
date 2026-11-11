import { consultar } from '../infra/bd.js';

/**
 * Solicitudes e intercambios (modulo 4, epica LET-114, RF-17 a RF-21). Solo
 * SQL: cuando se puede solicitar, aceptar, cancelar o confirmar lo decide
 * `domain/solicitudes.js`, siempre dentro de una transaccion.
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * @typedef {object} FilaSolicitud
 * @property {string} id
 * @property {string} publicacion_id
 * @property {string} solicitante_id
 * @property {string} libro_ofrecido_id
 * @property {'pendiente' | 'aceptada' | 'rechazada' | 'cancelada' | 'completada' | 'flagueada'} estado
 * @property {Date | null} aceptada_en
 * @property {Date | null} vence_en
 * @property {Date | null} confirmada_propietario_en
 * @property {Date | null} confirmada_solicitante_en
 * @property {string | null} cancelada_por
 * @property {Date | null} cerrada_en
 * @property {Date} creada_en
 * @property {Date | null} flagueada_en - cuando vencio el plazo sin las dos confirmaciones (RF-23).
 * @property {string | null} motivo_flagueo
 */

/**
 * La solicitud con lo que necesita la interfaz: la publicacion, los dos
 * libros y las dos partes, en una sola consulta.
 *
 * @typedef {FilaSolicitud & {
 *   propietario_id: string, libro_solicitado_id: string, publicacion_estado: string,
 *   solicitado_titulo: string, solicitado_autor: string,
 *   ofrecido_titulo: string, ofrecido_autor: string,
 *   propietario_nombre: string, solicitante_nombre: string
 * }} FilaSolicitudCompleta
 */

const COLUMNAS =
  'id, publicacion_id, solicitante_id, libro_ofrecido_id, estado, aceptada_en, vence_en, ' +
  'confirmada_propietario_en, confirmada_solicitante_en, cancelada_por, cerrada_en, creada_en, ' +
  'flagueada_en, motivo_flagueo';

const SELECT_COMPLETA = `
  SELECT s.id, s.publicacion_id, s.solicitante_id, s.libro_ofrecido_id, s.estado,
         s.aceptada_en, s.vence_en, s.confirmada_propietario_en, s.confirmada_solicitante_en,
         s.cancelada_por, s.cerrada_en, s.creada_en, s.flagueada_en, s.motivo_flagueo,
         p.usuario_id AS propietario_id, p.libro_id AS libro_solicitado_id,
         p.estado AS publicacion_estado,
         ls.titulo AS solicitado_titulo, ls.autor AS solicitado_autor,
         lo.titulo AS ofrecido_titulo, lo.autor AS ofrecido_autor,
         up.nombre AS propietario_nombre, us.nombre AS solicitante_nombre
    FROM solicitudes s
    JOIN publicaciones p ON p.id = s.publicacion_id
    JOIN libros ls ON ls.id = p.libro_id
    JOIN libros lo ON lo.id = s.libro_ofrecido_id
    JOIN usuarios up ON up.id = p.usuario_id
    JOIN usuarios us ON us.id = s.solicitante_id`;

/** Estados en los que una solicitud sigue abierta (todavia compromete libros). */
export const ESTADOS_ABIERTOS = ['pendiente', 'aceptada', 'flagueada'];

/**
 * Inserta una solicitud pendiente.
 *
 * @param {{ publicacion_id: string | number, solicitante_id: string | number, libro_ofrecido_id: string | number }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud>}
 */
export async function insertarSolicitud(
  { publicacion_id, solicitante_id, libro_ofrecido_id },
  ejecutar = consultar,
) {
  const { rows } = await ejecutar(
    `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [publicacion_id, solicitante_id, libro_ofrecido_id],
  );
  return rows[0];
}

/**
 * Lee una solicitud bloqueando su fila (`FOR UPDATE`) hasta el fin de la
 * transaccion. Es el primer bloqueo de toda accion sobre una solicitud.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud | null>}
 */
export async function bloquearSolicitud(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`SELECT ${COLUMNAS} FROM solicitudes WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

/**
 * La solicitud con su publicacion, sus libros y sus partes.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitudCompleta | null>}
 */
export async function buscarSolicitud(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`${SELECT_COMPLETA} WHERE s.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Si el usuario ya tiene una solicitud pendiente sobre la publicacion.
 *
 * @param {string | number} publicacion_id
 * @param {string | number} solicitante_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<boolean>}
 */
export async function tienePendiente(publicacion_id, solicitante_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT 1 FROM solicitudes
      WHERE publicacion_id = $1 AND solicitante_id = $2 AND estado = 'pendiente'`,
    [publicacion_id, solicitante_id],
  );
  return rows.length > 0;
}

/**
 * Solicitudes de un usuario (RF-18): las que recibio sobre sus publicaciones
 * o las que envio, de la mas nueva a la mas vieja, con filtro de estado.
 *
 * @param {string | number} usuario_id
 * @param {{ rol: 'recibidas' | 'enviadas', estado?: string, limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: FilaSolicitudCompleta[], total: number }>}
 */
export async function listarSolicitudesDe(
  usuario_id,
  { rol, estado, limite, desplazamiento },
  ejecutar = consultar,
) {
  const parametros = [usuario_id];
  let filtro = rol === 'enviadas' ? 's.solicitante_id = $1' : 'p.usuario_id = $1';
  if (estado) {
    parametros.push(estado);
    filtro += ' AND s.estado = $2';
  }

  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total
       FROM solicitudes s
       JOIN publicaciones p ON p.id = s.publicacion_id
      WHERE ${filtro}`,
    parametros,
  );
  const { rows } = await ejecutar(
    `${SELECT_COMPLETA}
      WHERE ${filtro}
      ORDER BY s.creada_en DESC, s.id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    parametros,
  );
  return { filas: rows, total: conteo[0].total };
}

/**
 * Las solicitudes abiertas (pendiente, aceptada o flagueada) en las que el
 * usuario es parte, como solicitante o como dueño de la publicacion. Para la
 * baja de cuenta (RF-09).
 *
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud[]>}
 */
export async function solicitudesAbiertasDeUsuario(usuario_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT s.${COLUMNAS.split(', ').join(', s.')}
       FROM solicitudes s
       JOIN publicaciones p ON p.id = s.publicacion_id
      WHERE (s.solicitante_id = $1 OR p.usuario_id = $1)
        AND s.estado IN ('pendiente', 'aceptada', 'flagueada')
      ORDER BY s.id`,
    [usuario_id],
  );
  return rows;
}

/**
 * Pasa a `aceptada` con su plazo de confirmacion (RF-19, RF-22).
 *
 * @param {string | number} id
 * @param {Date} vence_en
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud>}
 */
export async function marcarAceptada(id, vence_en, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE solicitudes
        SET estado = 'aceptada', aceptada_en = now(), vence_en = $2
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, vence_en],
  );
  return rows[0];
}

/**
 * Pasa a un estado de cierre (`rechazada`, `cancelada` o `completada`) y
 * sella `cerrada_en`. Si cancela, guarda quien lo hizo.
 *
 * @param {string | number} id
 * @param {'rechazada' | 'cancelada' | 'completada'} estado
 * @param {{ canceladaPor?: string | number | null }} [extra]
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud>}
 */
export async function cerrarSolicitud(id, estado, { canceladaPor = null } = {}, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE solicitudes
        SET estado = $2, cerrada_en = now(), cancelada_por = $3
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, estado, canceladaPor],
  );
  return rows[0];
}

/**
 * Cierra de una vez las pendientes de una publicacion, menos una: las que
 * pierden cuando se acepta otra (`rechazada`) o cuando se retira la
 * publicacion (`cancelada`).
 *
 * @param {string | number} publicacion_id
 * @param {'rechazada' | 'cancelada'} estado
 * @param {{ excepto?: string | number | null, canceladaPor?: string | number | null }} [opciones]
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cuantas cerro.
 */
export async function cerrarPendientesDePublicacion(
  publicacion_id,
  estado,
  { excepto = null, canceladaPor = null } = {},
  ejecutar = consultar,
) {
  const parametros = [publicacion_id, estado, canceladaPor];
  let filtro = '';
  if (excepto != null) {
    parametros.push(excepto);
    filtro = 'AND id <> $4';
  }
  const { rowCount } = await ejecutar(
    `UPDATE solicitudes
        SET estado = $2, cerrada_en = now(), cancelada_por = $3
      WHERE publicacion_id = $1 AND estado = 'pendiente' ${filtro}`,
    parametros,
  );
  return rowCount ?? 0;
}

/**
 * Registra la confirmacion de una de las partes (RF-21). Confirmar dos veces
 * no cambia la fecha de la primera.
 *
 * @param {string | number} id
 * @param {'propietario' | 'solicitante'} parte
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSolicitud>}
 */
export async function marcarConfirmacion(id, parte, ejecutar = consultar) {
  const columna = parte === 'propietario' ? 'confirmada_propietario_en' : 'confirmada_solicitante_en';
  const { rows } = await ejecutar(
    `UPDATE solicitudes
        SET ${columna} = COALESCE(${columna}, now())
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id],
  );
  return rows[0];
}

/**
 * Flaguea las aceptadas cuyo plazo vencio (RF-23, LET-155): `flagueada`, con
 * fecha y motivo. Es idempotente: una flagueada ya no es aceptada.
 *
 * @param {string} motivo
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cuantas flagueo.
 */
export async function flaguearVencidas(motivo, ejecutar = consultar) {
  const { rowCount } = await ejecutar(
    `UPDATE solicitudes
        SET estado = 'flagueada', flagueada_en = now(), motivo_flagueo = $1
      WHERE estado = 'aceptada' AND vence_en < now()`,
    [motivo],
  );
  return rowCount ?? 0;
}

/**
 * Los intercambios que alguna vez se flaguearon (RF-23, LET-157), del mas
 * reciente al mas viejo, con su estado actual. `soloFlagueadas` deja los que
 * siguen flagueados (el filtro por defecto del panel).
 *
 * @param {{ soloFlagueadas: boolean, limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: FilaSolicitudCompleta[], total: number }>}
 */
export async function listarFlagueadas({ soloFlagueadas, limite, desplazamiento }, ejecutar = consultar) {
  const filtro = soloFlagueadas
    ? "s.flagueada_en IS NOT NULL AND s.estado = 'flagueada'"
    : 's.flagueada_en IS NOT NULL';
  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total FROM solicitudes s WHERE ${filtro}`,
  );
  const { rows } = await ejecutar(
    `${SELECT_COMPLETA}
      WHERE ${filtro}
      ORDER BY s.flagueada_en DESC, s.id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
  );
  return { filas: rows, total: conteo[0].total };
}
