import pg from 'pg';

import { obtenerConfig } from './config.js';

/**
 * Pool de conexiones a PostgreSQL. Uno solo para todo el proceso, creado de
 * forma perezosa la primera vez que se necesita (asi importar este modulo no
 * exige tener la config lista, y las pruebas que inyectan su propio ejecutor no
 * abren un pool real).
 *
 * Neon: conviene el endpoint `-pooler` en la cadena de conexion y `sslmode=require`.
 * Cuando la config marca TLS activamos `ssl` con verificacion del certificado
 * del servidor. Neon usa una CA publica que Node ya trae en su almacen, asi que
 * no hace falta bajar `rejectUnauthorized`: cifrar sin verificar deja la puerta
 * abierta a un intermediario, y por esta conexion viajan hashes de contrasena y
 * tokens de recuperacion.
 */
const { Pool } = pg;

/** @type {pg.Pool | null} */
let pool = null;

/** Devuelve el pool, creandolo la primera vez. */
export function obtenerPool() {
  if (pool == null) {
    const config = obtenerConfig();
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.bdUsaSsl ? { rejectUnauthorized: true } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (error) => {
      // Un cliente ocioso se cayo. No tumbamos el proceso: el pool lo reemplaza.
      console.error(
        'Error en un cliente ocioso del pool de PostgreSQL:',
        error.message,
      );
    });
  }
  return pool;
}

/**
 * Ejecuta una consulta parametrizada contra el pool.
 *
 * @param {string} texto - SQL con placeholders `$1, $2, ...`.
 * @param {unknown[]} [parametros] - valores para los placeholders.
 * @returns {Promise<import('pg').QueryResult>}
 */
export function consultar(texto, parametros) {
  return obtenerPool().query(texto, parametros);
}

/**
 * Toma un cliente dedicado del pool, para transacciones. Hay que liberarlo
 * siempre con `cliente.release()`.
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
export function obtenerCliente() {
  return obtenerPool().connect();
}

/** Cierra el pool si estaba abierto. Se usa al apagar el proceso y en pruebas. */
export async function cerrarPool() {
  if (pool != null) {
    await pool.end();
    pool = null;
  }
}
