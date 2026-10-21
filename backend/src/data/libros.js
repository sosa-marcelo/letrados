import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaLibro
 * @property {string} id
 * @property {string} usuario_id
 * @property {string} titulo
 * @property {string} autor
 * @property {number} cantidad_total
 * @property {number} cantidad_reservada
 * @property {Date | null} archivado_en
 * @property {Date} creado_en
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

const COLUMNAS =
  'id, usuario_id, titulo, autor, cantidad_total, cantidad_reservada, archivado_en, creado_en';

/**
 * Inserta un libro con `cantidad_reservada = 0` (el DEFAULT de la columna).
 *
 * @param {{ usuario_id: string | number, titulo: string, autor: string, cantidad_total: number }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro>}
 */
export async function insertarLibro(
  { usuario_id, titulo, autor, cantidad_total },
  ejecutar = consultar,
) {
  const { rows } = await ejecutar(
    `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [usuario_id, titulo, autor, cantidad_total],
  );
  return rows[0];
}

/**
 * Lee un libro del usuario, no archivado, bloqueando la fila (`FOR UPDATE`)
 * hasta el fin de la transaccion. Se usa SIEMPRE dentro de `enTransaccion`:
 * el bloqueo es lo que impide que una aceptacion simultanea (modulo 4) suba
 * `cantidad_reservada` entre la validacion y el UPDATE.
 *
 * Que el libro sea de otro devuelve `null`, igual que si no existiera.
 *
 * @param {string | number} id
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro | null>}
 */
export async function bloquearLibroPropio(id, usuario_id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM libros
      WHERE id = $1
        AND usuario_id = $2
        AND archivado_en IS NULL
        FOR UPDATE`,
    [id, usuario_id],
  );
  return rows[0] ?? null;
}

/**
 * Reemplaza titulo, autor y cantidad total. Nunca toca `cantidad_reservada`:
 * el modulo 3 solo la lee.
 *
 * @param {string | number} id
 * @param {{ titulo: string, autor: string, cantidad_total: number }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro>}
 */
export async function actualizarLibro(id, { titulo, autor, cantidad_total }, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE libros
        SET titulo = $2, autor = $3, cantidad_total = $4
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, titulo, autor, cantidad_total],
  );
  return rows[0];
}

/**
 * Archiva un libro: deja la fila para el historial y lo saca del catalogo.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<void>}
 */
export async function archivarLibro(id, ejecutar = consultar) {
  await ejecutar(`UPDATE libros SET archivado_en = now() WHERE id = $1`, [id]);
}

/**
 * Borra un libro.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<void>}
 */
export async function borrarLibro(id, ejecutar = consultar) {
  await ejecutar(`DELETE FROM libros WHERE id = $1`, [id]);
}

/**
 * Lo que impide retirar un libro (RF-12): publicaciones activas o reservadas y
 * solicitudes de intercambio abiertas que lo involucren.
 *
 * Las tablas `publicaciones` e `intercambios` llegan con el modulo 4 (fuera del
 * alcance del ciclo 2): hasta entonces no existe nada que pueda estorbar y la
 * funcion devuelve ceros. Cuando lleguen, se reemplaza el cuerpo por los dos
 * `COUNT` y el dominio no cambia.
 *
 * @param {string | number} _id
 * @param {Ejecutor} [_ejecutar]
 * @returns {Promise<{ publicaciones: number, intercambios: number }>}
 */
export async function contarEstorbosDeRetiro(_id, _ejecutar = consultar) {
  return { publicaciones: 0, intercambios: 0 };
}

/**
 * Si el libro participo en intercambios completados (decide archivar o borrar).
 * Igual que `contarEstorbosDeRetiro`: sin la tabla de intercambios (modulo 4),
 * ningun libro tiene historial todavia.
 *
 * @param {string | number} _id
 * @param {Ejecutor} [_ejecutar]
 * @returns {Promise<boolean>}
 */
export async function tieneIntercambiosCompletados(_id, _ejecutar = consultar) {
  return false;
}

/**
 * Pagina del catalogo propio, sin archivados, del mas nuevo al mas viejo.
 * `q` busca por subcadena en titulo o autor, sin distinguir mayusculas.
 *
 * @param {string | number} usuario_id
 * @param {{ q?: string, limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: FilaLibro[], total: number }>}
 */
export async function listarLibrosDeUsuario(
  usuario_id,
  { q, limite, desplazamiento },
  ejecutar = consultar,
) {
  const parametros = [usuario_id];
  let filtro = '';
  if (q) {
    parametros.push(`%${q}%`);
    filtro = `AND (titulo ILIKE $2 OR autor ILIKE $2)`;
  }

  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total
       FROM libros
      WHERE usuario_id = $1 AND archivado_en IS NULL ${filtro}`,
    parametros,
  );

  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM libros
      WHERE usuario_id = $1 AND archivado_en IS NULL ${filtro}
      ORDER BY creado_en DESC, id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    parametros,
  );

  return { filas: rows, total: conteo[0].total };
}
