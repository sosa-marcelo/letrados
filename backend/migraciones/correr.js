import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { obtenerCliente, cerrarPool } from '../src/infra/bd.js';
import { obtenerConfig } from '../src/infra/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Tabla donde el corredor anota que migracion ya aplico. */
const SQL_CREAR_REGISTRO = `
  CREATE TABLE migraciones_aplicadas (
    nombre       TEXT        PRIMARY KEY,
    aplicada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * Crea la tabla de registro si todavia no existe. Se consulta el catalogo en
 * vez de usar `CREATE TABLE IF NOT EXISTS` para no depender de esa clausula.
 *
 * @param {import('pg').PoolClient | import('pg').Client} cliente
 */
async function asegurarTablaRegistro(cliente) {
  const { rows } = await cliente.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'migraciones_aplicadas'`,
  );
  if (rows.length === 0) {
    await cliente.query(SQL_CREAR_REGISTRO);
  }
}

/**
 * Lista los archivos `.sql` de un directorio, ordenados por nombre. El prefijo
 * numerico (`001_`, `002_`, ...) fija el orden de aplicacion.
 *
 * @param {string} directorio
 * @returns {Promise<string[]>}
 */
async function listarMigraciones(directorio) {
  const entradas = await readdir(directorio);
  return entradas.filter((n) => n.endsWith('.sql')).sort();
}

/**
 * Aplica las migraciones pendientes usando el cliente dado. Cada migracion corre
 * dentro de su propia transaccion y se registra en `migraciones_aplicadas`. Es
 * idempotente: lo ya aplicado se saltea.
 *
 * @param {object} opciones
 * @param {import('pg').PoolClient | import('pg').Client} opciones.cliente
 * @param {string} [opciones.directorio] - carpeta con los `.sql`.
 * @param {(mensaje: string) => void} [opciones.registrar] - a donde informar.
 * @returns {Promise<string[]>} nombres de las migraciones aplicadas en esta corrida.
 */
export async function correrMigraciones({
  cliente,
  directorio = __dirname,
  registrar = console.log,
}) {
  await asegurarTablaRegistro(cliente);

  const { rows } = await cliente.query(
    'SELECT nombre FROM migraciones_aplicadas',
  );
  const yaAplicadas = new Set(rows.map((f) => f.nombre));

  const archivos = await listarMigraciones(directorio);
  const aplicadas = [];

  for (const archivo of archivos) {
    if (yaAplicadas.has(archivo)) {
      registrar(`= ${archivo} (ya aplicada)`);
      continue;
    }

    const sql = await readFile(join(directorio, archivo), 'utf8');

    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query(
        'INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)',
        [archivo],
      );
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw new Error(
        `La migracion ${archivo} fallo y se revirtio: ${error.message}`,
      );
    }

    registrar(`+ ${archivo} aplicada`);
    aplicadas.push(archivo);
  }

  if (aplicadas.length === 0) {
    registrar('Nada que aplicar: la base ya esta al dia.');
  }

  return aplicadas;
}

/**
 * Describe a donde se va a aplicar, sin exponer usuario ni contrasena.
 * Aplicar DDL sin ver el destino es como firmar sin leer.
 *
 * @param {string} url - cadena de conexion.
 * @returns {string}
 */
function describirDestino(url) {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return '(no se pudo leer el destino de DATABASE_URL)';
  }
}

/** Ejecuta el corredor contra el pool del proyecto. Lo usa `npm run migrar`. */
async function principal() {
  console.log(`Aplicando migraciones en ${describirDestino(obtenerConfig().databaseUrl)}`);
  const cliente = await obtenerCliente();
  try {
    await correrMigraciones({ cliente });
  } finally {
    cliente.release();
    await cerrarPool();
  }
}

// Solo corre si se invoca directamente (no al importarlo desde una prueba).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
