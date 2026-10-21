import jwt from 'jsonwebtoken';

import { obtenerConfig } from './config.js';

/**
 * Firma un token de sesion.
 *
 * El id viaja en `sub` (decision de LET-18, no se toca). El `rol` viaja como
 * conveniencia de lectura para el cliente: la autorizacion lo lee de la fila de
 * `usuarios`, nunca del token. El `jti` es el identificador de la fila en
 * `sesiones`: es lo que hace revocable a un token que, por si mismo, no lo es.
 *
 * @param {string | number} usuarioId
 * @param {{ rol: string, jti: string }} datos
 * @returns {string}
 */
export function firmar(usuarioId, { rol, jti }) {
  const { jwtSecreto, jwtVencimiento } = obtenerConfig();

  return jwt.sign({ sub: String(usuarioId), rol }, jwtSecreto, {
    algorithm: 'HS256',
    expiresIn: jwtVencimiento,
    jwtid: jti,
  });
}

/**
 * Verifica un token y devuelve lo que trae.
 * Si el token es invalido, fue manipulado o vencio, la libreria lanza el error
 * y aca no se atrapa: quien llame decide que hacer.
 *
 * @param {string} token
 * @returns {{ id: string, rol: string | undefined, jti: string | undefined }}
 */
export function verificar(token) {
  const { jwtSecreto } = obtenerConfig();

  const carga = jwt.verify(token, jwtSecreto, { algorithms: ['HS256'] });
  return { id: String(carga.sub), rol: carga.rol, jti: carga.jti };
}

/**
 * Fecha de vencimiento de un token ya firmado (su claim `exp`). La usa el
 * dominio para que la fila de `sesiones` venza exactamente cuando vence el
 * token, sin duplicar el calculo de `JWT_VENCIMIENTO`.
 *
 * @param {string} token
 * @returns {Date}
 */
export function vencimientoDe(token) {
  const { exp } = jwt.decode(token);
  return new Date(exp * 1000);
}
