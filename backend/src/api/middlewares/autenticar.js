import jwt from 'jsonwebtoken';

import { ErrorDominio } from '../../domain/errores.js';
import { obtenerConfig } from '../../infra/config.js';

/**
 * Middleware de sesion. Lee `Authorization: Bearer <token>`, verifica el JWT
 * (HS256, firmado con `JWT_SECRETO`) y deja `req.usuario = { id }` con el `sub`
 * del token.
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
    const carga = jwt.verify(token, obtenerConfig().jwtSecreto, {
      algorithms: ['HS256'],
    });
    req.usuario = { id: String(carga.sub) };
    return next();
  } catch {
    return next(sesionInvalida());
  }
}

function sesionInvalida() {
  return new ErrorDominio(
    'SESION_INVALIDA',
    401,
    'La sesion no es valida o expiro. Inicia sesion de nuevo.',
  );
}

export default autenticar;
