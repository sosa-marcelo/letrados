import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaUsuario
 * @property {string} id - BIGSERIAL, llega como string desde pg.
 * @property {string} nombre
 * @property {string} email
 * @property {string} contrasena_hash
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
     RETURNING id, nombre, email, creado_en`,
    [nombre, email, contrasena_hash],
  );
  return rows[0];
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
    `SELECT id, nombre, email, contrasena_hash, creado_en
       FROM usuarios
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}
