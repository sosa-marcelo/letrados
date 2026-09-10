import { consultar } from '../infra/bd.js';

/**
 * @typedef {object} FilaToken
 * @property {string} id
 * @property {string} usuario_id
 * @property {string} token_hash - SHA-256 en hexadecimal (64 chars). Nunca el valor en claro.
 * @property {Date} expira_en
 * @property {Date | null} usado_en
 * @property {Date} creado_en
 */

/**
 * @typedef {(sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} Ejecutor
 */

const COLUMNAS = 'id, usuario_id, token_hash, expira_en, usado_en, creado_en';

/**
 * Inserta un token de recuperacion. `token_hash` ya viene hasheado (SHA-256)
 * desde `domain`; aca nunca entra el token en claro.
 *
 * @param {{ usuario_id: string | number, token_hash: string, expira_en: Date | string }} datos
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaToken>}
 */
export async function insertarToken(
  { usuario_id, token_hash, expira_en },
  ejecutar = consultar,
) {
  const { rows } = await ejecutar(
    `INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [usuario_id, token_hash, expira_en],
  );
  return rows[0];
}

/**
 * Busca un token vigente por su hash. Vigente = no usado y sin vencer.
 * La comparacion contra `now()` la hace PostgreSQL, no el proceso, para no
 * depender del reloj del servidor de aplicacion.
 *
 * @param {string} token_hash
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaToken | null>}
 */
export async function buscarTokenVigentePorHash(token_hash, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS}
       FROM tokens_recuperacion
      WHERE token_hash = $1
        AND usado_en IS NULL
        AND expira_en > now()`,
    [token_hash],
  );
  return rows[0] ?? null;
}

/**
 * Marca un token como usado (un solo uso). Sella `usado_en` con la hora de
 * PostgreSQL. Devuelve `null` si el id no existe **o si el token ya estaba
 * usado**.
 *
 * La guarda `usado_en IS NULL` convierte el UPDATE en un compare-and-swap: si
 * dos peticiones llegan con el mismo token a la vez, solo una recibe la fila; la
 * otra recibe `null` y `domain` la trata como token invalido. Sin esta guarda el
 * "un solo uso" no seria aplicable por mas cuidado que ponga `domain`.
 *
 * @param {string | number} id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<FilaToken | null>}
 */
export async function marcarTokenUsado(id, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `UPDATE tokens_recuperacion
        SET usado_en = now()
      WHERE id = $1
        AND usado_en IS NULL
      RETURNING ${COLUMNAS}`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Invalida todos los tokens pendientes (no usados) de un usuario, sellando
 * `usado_en`. Se llama al emitir un token nuevo y al completar una recuperacion,
 * para que no queden enlaces validos dando vueltas.
 *
 * @param {string | number} usuario_id
 * @param {Ejecutor} [ejecutar]
 * @returns {Promise<number>} cantidad de tokens invalidados.
 */
export async function invalidarTokensPendientesDeUsuario(
  usuario_id,
  ejecutar = consultar,
) {
  const { rowCount } = await ejecutar(
    `UPDATE tokens_recuperacion
        SET usado_en = now()
      WHERE usuario_id = $1
        AND usado_en IS NULL`,
    [usuario_id],
  );
  return rowCount ?? 0;
}
