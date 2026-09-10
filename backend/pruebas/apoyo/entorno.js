import { reiniciarConfig } from '../../src/infra/config.js';

/**
 * Variables de entorno minimas para que `obtenerConfig()` no falle en las
 * pruebas que lo necesitan (p. ej. el middleware `autenticar`, que lee
 * `JWT_SECRETO`). No apuntan a nada real: la base nunca se conecta.
 */
const ENTORNO_PRUEBA = {
  DATABASE_URL: 'postgres://u:c@localhost:5432/letrados_prueba',
  JWT_SECRETO: 'secreto-de-prueba-largo-y-nada-secreto-0123456789',
  JWT_VENCIMIENTO: '24h',
  CORREO_PROVEEDOR: 'consola',
  URL_FRONTEND: 'http://localhost:5173',
};

/** El secreto con el que hay que firmar los tokens de prueba. */
export const JWT_SECRETO_PRUEBA = ENTORNO_PRUEBA.JWT_SECRETO;

/**
 * Carga el entorno de prueba en `process.env` y limpia el cache de config.
 * Llamar en un `beforeAll`.
 *
 * @param {Record<string, string>} [extra] - para sobreescribir alguna variable.
 */
export function prepararEntorno(extra = {}) {
  Object.assign(process.env, ENTORNO_PRUEBA, extra);
  reiniciarConfig();
}

/** Saca las variables de prueba de `process.env`. Llamar en un `afterAll`. */
export function limpiarEntorno() {
  for (const clave of Object.keys(ENTORNO_PRUEBA)) {
    delete process.env[clave];
  }
  reiniciarConfig();
}
