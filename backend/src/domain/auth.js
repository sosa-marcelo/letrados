import { noImplementado } from './errores.js';

/**
 * Reglas de negocio de autenticacion.
 *
 * LET-18 solo congela el contrato: cada funcion existe con su firma definitiva y
 * hoy lanza `NO_IMPLEMENTADO` (501). Las epicas LET-12 a LET-15 rellenan cada
 * una su funcion sin tocar rutas ni controladores.
 *
 * Ninguna funcion conoce HTTP: reciben datos planos y devuelven datos planos o
 * lanzan `ErrorDominio`.
 */

/**
 * Registra un usuario nuevo y devuelve su sesion.
 * Epica LET-12.
 *
 * @param {{ nombre: string, email: string, contrasena: string }} _datos
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
// eslint-disable-next-line no-unused-vars
export async function registrar(_datos) {
  throw noImplementado('El registro todavia no esta implementado (LET-12)');
}

/**
 * Valida credenciales y devuelve una sesion. Ante cualquier fallo lanza
 * `CREDENCIALES_INVALIDAS` sin distinguir si fallo el correo o la contrasena.
 * Epica LET-13.
 *
 * @param {{ email: string, contrasena: string }} _datos
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
// eslint-disable-next-line no-unused-vars
export async function iniciarSesion(_datos) {
  throw noImplementado('El inicio de sesion todavia no esta implementado (LET-13)');
}

/**
 * Devuelve los datos publicos del usuario de la sesion actual.
 * Epica LET-13.
 *
 * @param {string} _usuarioId
 * @returns {Promise<{ id: string, nombre: string, email: string }>}
 */
// eslint-disable-next-line no-unused-vars
export async function usuarioActual(_usuarioId) {
  throw noImplementado('La consulta del usuario actual todavia no esta implementada (LET-13)');
}

/**
 * Inicia una recuperacion de contrasena. No revela si el correo existe: el
 * controlador responde siempre igual.
 * Epica LET-14.
 *
 * @param {{ email: string }} _datos
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
export async function pedirRecuperacion(_datos) {
  throw noImplementado('El pedido de recuperacion todavia no esta implementado (LET-14)');
}

/**
 * Completa una recuperacion: valida el token de un solo uso y cambia la
 * contrasena. Token malo, vencido o usado -> `TOKEN_INVALIDO`.
 * Epica LET-15.
 *
 * @param {{ token: string, contrasena: string }} _datos
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
export async function confirmarRecuperacion(_datos) {
  throw noImplementado('La confirmacion de recuperacion todavia no esta implementada (LET-15)');
}
