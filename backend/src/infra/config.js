/**
 * Configuracion del backend. Lee las variables de entorno, las valida y las
 * expone ya normalizadas.
 *
 * Las variables se cargan antes con el flag nativo de Node:
 *   node --env-file=.env src/servidor.js
 * o las inyecta el hosting. Este modulo no lee el archivo por su cuenta.
 *
 * `obtenerConfig()` valida la primera vez que se la llama y cachea el resultado.
 * `servidor.js` la llama apenas arranca, asi el proceso falla de entrada y con
 * un mensaje claro si falta una variable.
 */

/** Variables que siempre tienen que estar. */
const OBLIGATORIAS = [
  'DATABASE_URL',
  'JWT_SECRETO',
  'JWT_VENCIMIENTO',
  'CORREO_PROVEEDOR',
  'URL_FRONTEND',
];

/**
 * Valida el objeto de entorno y devuelve la configuracion normalizada.
 * No cachea ni toca `process.env`: se le pasa el entorno. Util para pruebas.
 *
 * @param {NodeJS.ProcessEnv} entorno
 * @returns {{
 *   databaseUrl: string,
 *   jwtSecreto: string,
 *   jwtVencimiento: string,
 *   correoProveedor: string,
 *   correoApiKey: string,
 *   urlFrontend: string,
 *   puerto: number,
 *   bdUsaSsl: boolean
 * }}
 */
export function construirConfig(entorno) {
  for (const clave of OBLIGATORIAS) {
    const valor = entorno[clave];
    if (valor == null || String(valor).trim() === '') {
      throw new Error(`Falta la variable de entorno: ${clave}`);
    }
  }

  const correoProveedor = entorno.CORREO_PROVEEDOR.trim().toLowerCase();
  const correoApiKey = (entorno.CORREO_API_KEY ?? '').trim();

  // La clave del proveedor de correo solo se exige cuando el proveedor es real.
  // Con CORREO_PROVEEDOR=consola no hace falta: seria pedir una credencial para
  // algo que solo escribe en stdout.
  if (correoProveedor !== 'consola' && correoApiKey === '') {
    throw new Error('Falta la variable de entorno: CORREO_API_KEY');
  }

  const databaseUrl = entorno.DATABASE_URL.trim();

  return {
    databaseUrl,
    jwtSecreto: entorno.JWT_SECRETO,
    jwtVencimiento: entorno.JWT_VENCIMIENTO.trim(),
    correoProveedor,
    correoApiKey,
    urlFrontend: entorno.URL_FRONTEND.trim(),
    puerto: Number(entorno.PORT) || 3000,
    // Neon exige TLS. Lo detectamos por la cadena de conexion.
    bdUsaSsl:
      /sslmode=require/.test(databaseUrl) || /\.neon\.tech/.test(databaseUrl),
  };
}

/** @type {ReturnType<typeof construirConfig> | null} */
let cache = null;

/**
 * Configuracion efectiva del proceso, leida de `process.env`. Valida la primera
 * vez y cachea. Lanza si falta una variable obligatoria.
 *
 * @returns {ReturnType<typeof construirConfig>}
 */
export function obtenerConfig() {
  if (cache == null) {
    cache = construirConfig(process.env);
  }
  return cache;
}

/** Borra el cache. Solo para pruebas. */
export function reiniciarConfig() {
  cache = null;
}
