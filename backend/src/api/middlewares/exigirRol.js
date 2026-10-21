import { accesoDenegado } from '../../domain/errores.js';

/**
 * Exige un rol (LET-49). Se monta SIEMPRE despues de `autenticar`: sin sesion
 * no hay rol que exigir. Lee el rol de `req.usuario`, que `autenticar` cargo de
 * la fila de `usuarios` (nunca del token).
 *
 * ```js
 * router.get('/admin/cuentas', autenticar, exigirRol('administrador'), ...)
 * ```
 *
 * @param {'usuario' | 'administrador'} rol
 * @returns {import('express').RequestHandler} 403 ACCESO_DENEGADO si no coincide.
 */
export function exigirRol(rol) {
  return function exigirRolMiddleware(req, _res, next) {
    if (req.usuario?.rol !== rol) return next(accesoDenegado());
    return next();
  };
}

export default exigirRol;
