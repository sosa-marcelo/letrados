import { randomUUID } from 'node:crypto';

/**
 * Identificador de una sesion nueva (el `jti` del token y la clave de la fila
 * en `sesiones`). Vive en `infra` porque es transporte, no negocio.
 *
 * @returns {string} UUID v4.
 */
export function nuevoJti() {
  return randomUUID();
}
