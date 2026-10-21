import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaUsuario
 * @property {string} id - BIGSERIAL, llega como string desde pg.
 * @property {string} nombre
 * @property {string} email
 * @property {string} contrasena_hash
 * @property {'usuario' | 'administrador'} rol
 * @property {'activa' | 'bloqueada' | 'eliminada'} estado
 * @property {Date} creado_en
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

/**
 * Inserta un usuario nuevo.
 *
 * No valida nada de negocio (unicidad del email, formato, etc.): eso es de la
 * capa `domain`. Si el email ya existe, PostgreSQL rechaza por la restriccion
 * `UNIQUE` y el error sube tal cual.
 *
 * @param {{ nombre: string, email: string, contrasena_hash: string }} datos
 * @param {Ejecutor} [ejecutar] - ejecutor de consultas; por defecto el pool.
 * @returns {Promise<{ id: string, nombre: string, email: string, creado_en: Date }>}
 */
export async function insertarUsuario(
  { nombre, email, contrasena_hash },
  ejecutar = consultar,
) {
  const { rows } = await ejecutar(
    `INSERT INTO usuarios (nombre, email, contrasena_hash)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, email, rol, estado, creado_en`,
    [nombre, email, contrasena_hash],
  );
  return rows[0];
}

/**
 * Busca un usuario por su id. Sin `contrasena_hash`: la usan lugares que ya
 * confian en la sesion (p. ej. `GET /api/auth/yo`) y no necesitan el hash.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<Omit<FilaUsuario, 'contrasena_hash'> | null>}
 */
export async function buscarUsuarioPorId(id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT id, nombre, email, rol, estado, creado_en
       FROM usuarios
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Busca un usuario por su correo. Devuelve la fila completa, con
 * `contrasena_hash` incluido, porque `domain` la necesita para verificar el
 * login.
 *
 * El correo se compara tal cual llega: la normalizacion a minusculas y sin
 * espacios la hace `domain` antes de pasar por aca.
 *
 * @param {string} email
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaUsuario | null>}
 */
export async function buscarUsuarioPorEmail(email, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT id, nombre, email, contrasena_hash, rol, estado, creado_en
       FROM usuarios
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Actualiza la contrasena de un usuario. Sin el hash: `domain` ya la hasheo
 * antes de llamar aca.
 *
 * @param {string | number} id
 * @param {string} contrasena_hash
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ id: string, nombre: string, email: string } | null>}
 */
export async function actualizarContrasena(id, contrasena_hash, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE usuarios
        SET contrasena_hash = $2
      WHERE id = $1
      RETURNING id, nombre, email`,
    [id, contrasena_hash],
  );
  return rows[0] ?? null;
}

/**
 * Hash de la contrasena de un usuario, para reautenticar (baja de cuenta).
 * Separado de `buscarUsuarioPorId` para que el hash no viaje a donde no hace falta.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<string | null>}
 */
export async function buscarHashDeUsuario(id, ejecutar = consultar) {
  const { rows } = await ejecutar(`SELECT contrasena_hash FROM usuarios WHERE id = $1`, [id]);
  return rows[0]?.contrasena_hash ?? null;
}

/**
 * Pagina de cuentas para el panel de administracion (RF-07), con la cantidad
 * de sesiones vigentes de cada una. `q` busca por subcadena en nombre o correo;
 * `estado` filtra si viene.
 *
 * @param {{ q?: string, estado?: string, limite: number, desplazamiento: number }} opciones
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<{ filas: Array<FilaUsuario & { sesiones_activas: number }>, total: number }>}
 */
export async function listarCuentas({ q, estado, limite, desplazamiento }, ejecutar = consultar) {
  const condiciones = [];
  const parametros = [];
  if (q) {
    parametros.push(`%${q}%`);
    condiciones.push(`(u.nombre ILIKE $${parametros.length} OR u.email ILIKE $${parametros.length})`);
  }
  if (estado) {
    parametros.push(estado);
    condiciones.push(`u.estado = $${parametros.length}`);
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: conteo } = await ejecutar(
    `SELECT count(*)::int AS total FROM usuarios u ${donde}`,
    parametros,
  );

  const { rows } = await ejecutar(
    `SELECT u.id, u.nombre, u.email, u.rol, u.estado, u.creado_en,
            count(s.jti)::int AS sesiones_activas
       FROM usuarios u
       LEFT JOIN sesiones s
              ON s.usuario_id = u.id
             AND s.revocada_en IS NULL
             AND s.expira_en > now()
       ${donde}
      GROUP BY u.id, u.nombre, u.email, u.rol, u.estado, u.creado_en
      ORDER BY u.creado_en DESC, u.id DESC
      LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`,
    parametros,
  );

  return { filas: rows, total: conteo[0].total };
}

/**
 * Lee una cuenta bloqueando la fila hasta el fin de la transaccion, para que
 * un bloqueo y una baja simultaneos no se pisen.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaUsuario | null>}
 */
export async function bloquearFilaUsuario(id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT id, nombre, email, rol, estado, creado_en
       FROM usuarios
      WHERE id = $1
        FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Cambia el estado de acceso de una cuenta: `bloqueada` (con `bloqueada_en`)
 * o `activa` (limpia `bloqueada_en`).
 *
 * @param {string | number} id
 * @param {'activa' | 'bloqueada'} estado
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaUsuario>}
 */
export async function actualizarEstadoCuenta(id, estado, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE usuarios
        SET estado = $2,
            bloqueada_en = ${estado === 'bloqueada' ? 'now()' : 'NULL'}
      WHERE id = $1
      RETURNING id, nombre, email, rol, estado, creado_en`,
    [id, estado],
  );
  return rows[0];
}

/**
 * Anonimiza una cuenta dada de baja (RF-09). No se borra la fila: es la
 * "referencia tecnica" que conservan los intercambios completados de terceros.
 *
 * - nombre `Cuenta eliminada`
 * - correo `eliminada+<id>@letrados.invalid` (RFC 2606: nunca recibe correo, y
 *   no choca con el indice unico)
 * - un `contrasena_hash` de 60 caracteres que no es un hash bcrypt valido: con
 *   el no se puede volver a entrar
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<void>}
 */
export async function anonimizarUsuario(id, ejecutar = consultar) {
  await ejecutar(
    `UPDATE usuarios
        SET nombre = 'Cuenta eliminada',
            email = 'eliminada+' || id::text || '@letrados.invalid',
            contrasena_hash = $2,
            estado = 'eliminada',
            eliminada_en = now(),
            bloqueada_en = NULL
      WHERE id = $1`,
    [id, HASH_INUTILIZABLE],
  );
}

/** 60 caracteres, sin el prefijo `$2`: ningun bcrypt lo acepta como hash. */
const HASH_INUTILIZABLE = '!'.repeat(60);
