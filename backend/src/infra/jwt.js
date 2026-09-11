import jwt from 'jsonwebtoken';

import { obtenerConfig } from './config.js';

/**
 * Firma un token de sesion para un usuario.
 * El id viaja en `sub`, que es de donde lo lee el middleware `autenticar`.
 */
export function firmar(usuarioId) {
  const { jwtSecreto, jwtVencimiento } = obtenerConfig();

  return jwt.sign({ sub: String(usuarioId) }, jwtSecreto, {
    algorithm: 'HS256',
    expiresIn: jwtVencimiento,
  });
}

/**
 * Verifica un token y devuelve el id del usuario.
 * Si el token es invalido, fue manipulado o vencio, la libreria lanza el error
 * y aca no se atrapa: quien llame decide que hacer.
 */
export function verificar(token) {
  const { jwtSecreto } = obtenerConfig();

  const carga = jwt.verify(token, jwtSecreto, { algorithms: ['HS256'] });
  return { id: String(carga.sub) };
}
