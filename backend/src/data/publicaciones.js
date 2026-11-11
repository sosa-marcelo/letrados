import { consultar } from '../infra/bd.js';

/**
 * Publicaciones (modulo 4, epica LET-113). Solo SQL: las reglas de cuando se
 * puede publicar, modificar o retirar viven en `domain/publicaciones.js`.
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * Fila de `publicaciones` sola.
 *
 * @typedef {object} FilaPublicacion
 * @property {string} id
 * @property {string} libro_id
 * @property {string} usuario_id
 * @property {'activa' | 'reservada' | 'cerrada' | 'retirada'} estado
 * @property {string | null} nota
 * @property {Date} creada_en
 * @property {Date | null} cerrada_en
 */

/**
 * Publicacion con su libro, su dueño y si tiene foto: lo que necesitan
 * Explorar, el detalle y el perfil publico, en una sola consulta.
 *
 * @typedef {FilaPublicacion & {
 *   titulo: string, autor: string, editorial: string | null,
 *   anio_publicacion: number | null, edicion: string | null, isbn: string | null,
 *   estado_conservacion: string | null, descripcion: string | null,
 *   cantidad_total: number, cantidad_reservada: number, libro_archivado_en: Date | null,
 *   propietario_nombre: string, propietario_estado: string, tiene_foto: boolean
 * }} FilaPublicacionCompleta
 */

const COLUMNAS = 'id, libro_id, usuario_id, estado, nota, creada_en, cerrada_en';

// La foto se une por LEFT JOIN y solo se lee su clave: los listados nunca
// traen la imagen.
const SELECT_COMPLETA = `
  SELECT p.id, p.libro_id, p.usuario_id, p.estado, p.nota, p.creada_en, p.cerrada_en,
         l.titulo, l.autor, l.editorial, l.anio_publicacion, l.edicion, l.isbn,
         l.estado_conservacion, l.descripcion, l.cantidad_total, l.cantidad_reservada,
         l.archivado_en AS libro_archivado_en,
         u.nombre AS propietario_nombre, u.estado AS propietario_estado,
         f.publicacion_id IS NOT NULL AS tiene_foto
    FROM publicaciones p
    JOIN libros l ON l.id = p.libro_id
    JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN fotos_publicacion f ON f.publicacion_id = p.id`;

// Lo que Explorar considera publicado y solicitable (RF-15).
const FILTRO_EXPLORAR = `
  p.estado = 'activa'
  AND l.archivado_en IS NULL
  AND l.cantidad_total - l.cantidad_reservada >= 1
  AND u.estado = 'activa'`;

/**
 * Inserta una publicacion activa.
 *
 * @param {{ libro_id: string | number, usuario_id: string | number, nota?: string | null }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion>}
 */
export async function insertarPublicacion({ libro_id, usuario_id, nota = null }, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `INSERT INTO publicaciones (libro_id, usuario_id, nota)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [libro_id, usuario_id, nota],
  );
  return rows[0];
}

/**
 * Lee una publicacion del usuario bloqueando la fila (`FOR UPDATE`) hasta el
 * fin de la transaccion. Que sea de otro devuelve `null`, igual que si no
 * existiera.
 *
 * @param {string | number} id
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion | null>}
 */
export async function bloquearPublicacionPropia(id, usuario_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM publicaciones
      WHERE id = $1 AND usuario_id = $2
        FOR UPDATE`,
    [id, usuario_id],
  );
  return rows[0] ?? null;
}

/**
 * Lee una publicacion cualquiera bloqueando su fila hasta el fin de la
 * transaccion. Lo usan las solicitudes (LET-138).
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion | null>}
 */
export async function bloquearPublicacion(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`SELECT ${COLUMNAS} FROM publicaciones WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

/**
 * La publicacion vigente (activa o reservada) de un libro, si la hay.
 *
 * @param {string | number} libro_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion | null>}
 */
export async function publicacionVigenteDeLibro(libro_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM publicaciones
      WHERE libro_id = $1 AND estado IN ('activa', 'reservada')`,
    [libro_id],
  );
  return rows[0] ?? null;
}

/**
 * Las publicaciones vigentes de varios libros, para marcar `publicado` en una
 * pagina entera del catalogo con una sola consulta.
 *
 * @param {Array<string | number>} libro_ids
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion[]>}
 */
export async function publicacionesVigentesDeLibros(libro_ids, ejecutar = consultar) {
  if (libro_ids.length === 0) return [];
  // IN ($1, $2, ...) y no ANY($1): pg-mem no resuelve ANY con un arreglo como
  // parametro. Sigue siendo una consulta parametrizada.
  const marcas = libro_ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM publicaciones
      WHERE libro_id IN (${marcas}) AND estado IN ('activa', 'reservada')`,
    libro_ids,
  );
  return rows;
}

/**
 * Reemplaza la nota.
 *
 * @param {string | number} id
 * @param {string | null} nota
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion>}
 */
export async function actualizarNota(id, nota, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE publicaciones SET nota = $2 WHERE id = $1 RETURNING ${COLUMNAS}`,
    [id, nota],
  );
  return rows[0];
}

/**
 * Cambia el estado. Al pasar a `cerrada` o `retirada` sella `cerrada_en`; al
 * volver a `activa` o `reservada` lo limpia.
 *
 * @param {string | number} id
 * @param {'activa' | 'reservada' | 'cerrada' | 'retirada'} estado
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacion>}
 */
export async function cambiarEstadoPublicacion(id, estado, ejecutar = consultar) {
  const termina = estado === 'cerrada' || estado === 'retirada';
  const { rows } = await ejecutar(
    `UPDATE publicaciones
        SET estado = $2, cerrada_en = ${termina ? 'now()' : 'NULL'}
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, estado],
  );
  return rows[0];
}

/**
 * Una publicacion con su libro, su dueño y si tiene foto, en cualquier estado.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacionCompleta | null>}
 */
export async function buscarPublicacion(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`${SELECT_COMPLETA} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Pagina de Explorar (RF-15): activas, de libros no archivados con al menos
 * un ejemplar disponible y de cuentas activas, de la mas nueva a la mas vieja.
 * `q` busca por subcadena en titulo o autor, sin distinguir mayusculas.
 *
 * @param {{ q?: string, limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: FilaPublicacionCompleta[], total: number }>}
 */
export async function listarPublicacionesActivas({ q, limite, desplazamiento }, ejecutar = consultar) {
  const parametros = [];
  let filtro = FILTRO_EXPLORAR;
  if (q) {
    parametros.push(`%${q}%`);
    filtro += ` AND (l.titulo ILIKE $1 OR l.autor ILIKE $1)`;
  }

  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total
       FROM publicaciones p
       JOIN libros l ON l.id = p.libro_id
       JOIN usuarios u ON u.id = p.usuario_id
      WHERE ${filtro}`,
    parametros,
  );

  const { rows } = await ejecutar(
    `${SELECT_COMPLETA}
      WHERE ${filtro}
      ORDER BY p.creada_en DESC, p.id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    parametros,
  );

  return { filas: rows, total: conteo[0].total };
}

/**
 * Las publicaciones que Explorar mostraria de un usuario, para su perfil
 * publico (RF-08), de la mas nueva a la mas vieja.
 *
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaPublicacionCompleta[]>}
 */
export async function publicacionesActivasDeUsuario(usuario_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `${SELECT_COMPLETA}
      WHERE p.usuario_id = $1 AND ${FILTRO_EXPLORAR}
      ORDER BY p.creada_en DESC, p.id DESC`,
    [usuario_id],
  );
  return rows;
}
