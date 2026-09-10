import { newDb } from 'pg-mem';

import { correrMigraciones } from '../../migraciones/correr.js';

/**
 * Levanta una base PostgreSQL en memoria (`pg-mem`) con las migraciones del
 * proyecto ya aplicadas. Para las pruebas de la capa `data`.
 *
 * OJO: `pg-mem` es Postgres reimplementado en JavaScript, no el motor. Sirve
 * para probar la forma del SQL; no reemplaza correr contra una base real.
 *
 * @returns {Promise<{
 *   db: import('pg-mem').IMemoryDb,
 *   cliente: any,
 *   ejecutar: (sql: string, parametros?: unknown[]) => Promise<{ rows: any[], rowCount: number }>
 * }>}
 */
export async function crearBdMemoria() {
  const db = newDb();
  const { Client } = db.adapters.createPg();
  const cliente = new Client();
  await cliente.connect();
  await correrMigraciones({ cliente, registrar: () => {} });

  const ejecutar = (sql, parametros) => cliente.query(sql, parametros);

  return { db, cliente, ejecutar };
}

/** Inserta un usuario directo por SQL y devuelve su fila. Atajo para las pruebas. */
export async function sembrarUsuario(
  ejecutar,
  { nombre = 'Persona', email = 'persona@ejemplo.com', contrasena_hash = 'hash' } = {},
) {
  const { rows } = await ejecutar(
    `INSERT INTO usuarios (nombre, email, contrasena_hash)
     VALUES ($1, $2, $3) RETURNING *`,
    [nombre, email, contrasena_hash],
  );
  return rows[0];
}
