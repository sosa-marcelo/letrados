import { rutaNoEncontrada as errorRutaNoEncontrada } from '../../domain/errores.js';

/**
 * Terminador del router de `/api`. Va al final de todas las rutas de la API y
 * antes de los estaticos de la SPA: cualquier `/api/...` que no matcheo una ruta
 * real cae aca y sale como 404 con el formato unico de error.
 *
 * Sin esto, Express sigue de largo y el comodin de la SPA responde `index.html`
 * con 200 a rutas de API mal escritas.
 */
export function rutaNoEncontrada(req, _res, next) {
  next(errorRutaNoEncontrada(`No existe la ruta ${req.method} ${req.originalUrl}`));
}

export default rutaNoEncontrada;
