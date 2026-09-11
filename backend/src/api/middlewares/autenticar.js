import { sesionInvalida } from '../../domain/errores.js';
import { verificar } from '../../infra/jwt.js';

/**
 * Middleware de sesion. Lee `Authorization: Bearer <token>` y delega en
 * `infra/jwt.verificar` (mismo lugar que firma el token en `infra/jwt.firmar`),
 * que devuelve `{ id }`. Deja `req.usuario = { id }`.
 *
 * Cualquier problema —header ausente, esquema distinto de Bearer, firma
 * invalida, token vencido— sale como 401 `SESION_INVALIDA`, sin decir cual de
 * los casos fue.
 *
 * El logout es del lado del cliente (borra el token): no hay lista de revocacion
 * en el servidor.
 *
 * @type {import('express').RequestHandler}
 */
export function autenticar(req, _res, next) {
  const cabecera = req.get('authorization') ?? '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(sesionInvalida());
  }

  try {
    const { id } = verificar(token);
    req.usuario = { id };
    return next();
  } catch {
    return next(sesionInvalida());
  }
}

export default autenticar;
