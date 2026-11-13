import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaLibro
 * @property {string} id
 * @property {string} usuario_id
 * @property {string} titulo
 * @property {string} autor
 * @property {number} cantidad_total
 * @property {number} cantidad_reservada
 * @property {string | null} editorial
 * @property {number | null} anio_publicacion
 * @property {string | null} edicion
 * @property {string | null} isbn
 * @property {string | null} estado_conservacion
 * @property {string | null} descripcion
 * @property {Date | null} archivado_en
 * @property {Date} creado_en
 */

/**
 * Lo que el usuario escribe de un libro (RF-10, RF-11 v1.1), en nombres de
 * columna. Los seis datos opcionales (migracion 005) van en `null` si no se
 * cargaron.
 *
 * @typedef {object} CamposLibro
 * @property {string} titulo
 * @property {string} autor
 * @property {number} cantidad_total
 * @property {string | null} [editorial]
 * @property {number | null} [anio_publicacion]
 * @property {string | null} [edicion]
 * @property {string | null} [isbn]
 * @property {string | null} [estado_conservacion]
 * @property {string | null} [descripcion]
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

const COLUMNAS =
  'id, usuario_id, titulo, autor, cantidad_total, cantidad_reservada, ' +
  'editorial, anio_publicacion, edicion, isbn, estado_conservacion, descripcion, ' +
  'archivado_en, creado_en';

/**
 * Los seis datos opcionales en el orden de los parametros de INSERT y UPDATE.
 *
 * @param {CamposLibro} campos
 * @returns {Array<string | number | null>}
 */
function datosOpcionales({
  editorial = null,
  anio_publicacion = null,
  edicion = null,
  isbn = null,
  estado_conservacion = null,
  descripcion = null,
}) {
  return [editorial, anio_publicacion, edicion, isbn, estado_conservacion, descripcion];
}

/**
 * Inserta un libro con `cantidad_reservada = 0` (el DEFAULT de la columna).
 *
 * @param {CamposLibro & { usuario_id: string | number }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro>}
 */
export async function insertarLibro(datos, ejecutar = consultar) {
  const { usuario_id, titulo, autor, cantidad_total } = datos;
  const { rows } = await ejecutar(
    `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total,
                         editorial, anio_publicacion, edicion, isbn,
                         estado_conservacion, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLUMNAS}`,
    [usuario_id, titulo, autor, cantidad_total, ...datosOpcionales(datos)],
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
 * Lee un libro cualquiera (de quien sea, archivado o no) bloqueando la fila
 * hasta el fin de la transaccion. Lo usan las solicitudes, que mueven
 * ejemplares de dos dueños a la vez (LET-138).
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro | null>}
 */
export async function bloquearLibro(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`SELECT ${COLUMNAS} FROM libros WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

/**
 * Mueve los ejemplares de un libro cuando una solicitud cambia de estado
 * (LET-138, RF-19 a RF-21). Es la unica escritura de `cantidad_reservada`:
 *
 * - `reservar`:  reservada + 1                 (al aceptar)
 * - `liberar`:   reservada - 1                 (al cancelar una aceptada)
 * - `descontar`: total - 1 y reservada - 1     (al completar)
 *
 * La restriccion `reservada_no_supera_total` y los CHECK >= 0 lo sostienen en
 * la base: un movimiento imposible falla en vez de dejar numeros invalidos.
 *
 * @param {string | number} id
 * @param {'reservar' | 'liberar' | 'descontar'} movimiento
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro>}
 */
export async function moverEjemplar(id, movimiento, ejecutar = consultar) {
  const cambios = {
    reservar: 'cantidad_reservada = cantidad_reservada + 1',
    liberar: 'cantidad_reservada = cantidad_reservada - 1',
    descontar: 'cantidad_total = cantidad_total - 1, cantidad_reservada = cantidad_reservada - 1',
  };
  const { rows } = await ejecutar(
    `UPDATE libros SET ${cambios[movimiento]} WHERE id = $1 RETURNING ${COLUMNAS}`,
    [id],
  );
  return rows[0];
}

/**
 * Reemplaza todo lo que escribe el usuario: titulo, autor, cantidad total y
 * los seis datos opcionales (el que no viene queda en `null`). Nunca toca
 * `cantidad_reservada`: el modulo 3 solo la lee.
 *
 * @param {string | number} id
 * @param {CamposLibro} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaLibro>}
 */
export async function actualizarLibro(id, datos, ejecutar = consultar) {
  const { titulo, autor, cantidad_total } = datos;
  const { rows } = await ejecutar(
    `UPDATE libros
        SET titulo = $2, autor = $3, cantidad_total = $4,
            editorial = $5, anio_publicacion = $6, edicion = $7, isbn = $8,
            estado_conservacion = $9, descripcion = $10
      WHERE id = $1
      RETURNING ${COLUMNAS}`,
    [id, titulo, autor, cantidad_total, ...datosOpcionales(datos)],
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
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ publicaciones: number, intercambios: number }>}
 */
export async function contarEstorbosDeRetiro(id, ejecutar = consultar) {
  const { rows: pubs } = await ejecutar(
    `SELECT count(*)::int AS n FROM publicaciones
      WHERE libro_id = $1 AND estado IN ('activa', 'reservada')`,
    [id],
  );
  const { rows: sols } = await ejecutar(
    `SELECT count(*)::int AS n FROM solicitudes s
       JOIN publicaciones p ON p.id = s.publicacion_id
      WHERE s.estado IN ('pendiente', 'aceptada', 'flagueada')
        AND (p.libro_id = $1 OR s.libro_ofrecido_id = $1)`,
    [id],
  );
  return { publicaciones: pubs[0].n, intercambios: sols[0].n };
}

/**
 * Si el libro tiene historial (alguna publicación o solicitud, en cualquier
 * estado): decide archivar o borrar.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<boolean>}
 */
export async function tieneHistorial(id, ejecutar = consultar) {
  // `libro_id + 0` y no `libro_id`: pg-mem (la base de las pruebas) resuelve la
  // busqueda con el indice parcial de publicaciones vigentes y no ve las
  // retiradas ni las cerradas. En PostgreSQL el resultado es el mismo.
  const { rows: pubs } = await ejecutar(
    `SELECT 1 FROM publicaciones WHERE libro_id + 0 = $1 LIMIT 1`,
    [id],
  );
  if (pubs.length > 0) return true;

  const { rows: sols } = await ejecutar(
    `SELECT 1 FROM solicitudes WHERE libro_ofrecido_id = $1 LIMIT 1`,
    [id],
  );
  return sols.length > 0;
}

/**
 * La version en lote de `tieneHistorial`: de una pagina entera del catalogo,
 * que libros tienen historial (alguna publicacion o solicitud, en cualquier
 * estado). Una consulta por tabla, no una por libro.
 *
 * @param {Array<string | number>} ids
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<Set<string>>} los ids con historial.
 */
export async function librosConHistorial(ids, ejecutar = consultar) {
  if (ids.length === 0) return new Set();
  const marcas = ids.map((_, i) => `$${i + 1}`).join(', ');
  // `libro_id + 0`: el mismo motivo que en `tieneHistorial` (pg-mem).
  const { rows: pubs } = await ejecutar(
    `SELECT libro_id FROM publicaciones WHERE libro_id + 0 IN (${marcas})`,
    ids,
  );
  const { rows: sols } = await ejecutar(
    `SELECT libro_ofrecido_id AS libro_id FROM solicitudes WHERE libro_ofrecido_id IN (${marcas})`,
    ids,
  );
  return new Set([...pubs, ...sols].map((fila) => String(fila.libro_id)));
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

/**
 * Archiva todos los libros vigentes de un usuario (baja de cuenta, RF-09).
 * No se borran: los intercambios completados los referencian.
 *
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cantidad archivada.
 */
export async function archivarLibrosDeUsuario(usuario_id, ejecutar = consultar) {
  const { rowCount } = await ejecutar(
    `UPDATE libros SET archivado_en = now()
      WHERE usuario_id = $1 AND archivado_en IS NULL`,
    [usuario_id],
  );
  return rowCount ?? 0;
}
