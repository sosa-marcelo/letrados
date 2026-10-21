import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaSesion
 * @property {string} jti - UUID; el mismo valor que viaja en el claim `jti` del token.
 * @property {string} usuario_id
 * @property {Date} emitida_en
 * @property {Date} expira_en
 * @property {Date | null} revocada_en
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

const COLUMNAS = 'jti, usuario_id, emitida_en, expira_en, revocada_en';

/**
 * Inserta una sesion nueva.
 *
 * @param {{ jti: string, usuario_id: string | number, expira_en: Date | string }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSesion>}
 */
export async function insertarSesion({ jti, usuario_id, expira_en }, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `INSERT INTO sesiones (jti, usuario_id, expira_en)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [jti, usuario_id, expira_en],
  );
  return rows[0];
}

/**
 * Busca una sesion vigente: sin revocar y sin vencer. La comparacion contra
 * `now()` la hace PostgreSQL, no el proceso.
 *
 * @param {string} jti
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaSesion | null>}
 */
export async function buscarSesionVigente(jti, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM sesiones
      WHERE jti = $1
        AND revocada_en IS NULL
        AND expira_en > now()`,
    [jti],
  );
  return rows[0] ?? null;
}

/**
 * Revoca una sesion. Si ya estaba revocada no la toca (la guarda
 * `revocada_en IS NULL` conserva la fecha de la primera revocacion).
 *
 * @param {string} jti
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cantidad de filas afectadas (0 o 1).
 */
export async function revocarSesion(jti, ejecutar = consultar) {
  const { rowCount } = await ejecutar(
    `UPDATE sesiones
        SET revocada_en = now()
      WHERE jti = $1
        AND revocada_en IS NULL`,
    [jti],
  );
  return rowCount ?? 0;
}

/**
 * Revoca todas las sesiones abiertas de un usuario. `excepto` deja viva una:
 * el cambio de contrasena (RF-05) no cierra la sesion desde la que se hizo.
 *
 * @param {string | number} usuario_id
 * @param {{ excepto?: string }} [opciones]
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cantidad de sesiones revocadas.
 */
export async function revocarSesionesDeUsuario(
  usuario_id,
  { excepto } = {},
  ejecutar = consultar,
) {
  const { rowCount } = excepto
    ? await ejecutar(
        `UPDATE sesiones
            SET revocada_en = now()
          WHERE usuario_id = $1
            AND revocada_en IS NULL
            AND jti <> $2`,
        [usuario_id, excepto],
      )
    : await ejecutar(
        `UPDATE sesiones
            SET revocada_en = now()
          WHERE usuario_id = $1
            AND revocada_en IS NULL`,
        [usuario_id],
      );
  return rowCount ?? 0;
}

/**
 * Borra las sesiones vencidas hace mas de `dias` dias. Limpieza, no seguridad:
 * una sesion vencida ya no autentica aunque siga en la tabla.
 *
 * @param {number} dias
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cantidad de filas borradas.
 */
export async function borrarSesionesVencidas(dias, ejecutar = consultar) {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const { rowCount } = await ejecutar(
    `DELETE FROM sesiones
      WHERE expira_en < $1`,
    [limite],
  );
  return rowCount ?? 0;
}
