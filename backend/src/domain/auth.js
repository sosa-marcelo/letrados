import { noImplementado, emailDuplicado } from './errores.js';
import { hashear } from '../infra/hash.js';
import { firmar } from '../infra/jwt.js';
import { insertarUsuario } from '../data/usuarios.js';

/**
 * Reglas de negocio de autenticacion.
 *
 * LET-18 congelo el contrato: cada funcion existe con su firma definitiva.
 * LET-13 a LET-15 quedan pendientes y siguen lanzando `NO_IMPLEMENTADO` (501).
 *
 * Ninguna funcion conoce HTTP: reciben datos planos y devuelven datos planos o
 * lanzan `ErrorDominio`.
 */

/** Codigo que PostgreSQL (y `pg-mem`) usan para una violacion de unicidad. */
const VIOLACION_UNICIDAD = '23505';

/**
 * Registra un usuario nuevo: hashea la contrasena, normaliza el correo a
 * minusculas y lo inserta. Devuelve una sesion recien firmada.
 *
 * No consulta si el correo existe antes de insertar: intenta el insert
 * directo y traduce el rechazo. Con una consulta previa, dos registros
 * simultaneos con el mismo correo pasarian los dos (ventana de carrera); el
 * `UNIQUE` de la base (mas el indice sobre `lower(email)` de la migracion 002)
 * es lo unico que lo evita de verdad.
 *
 * El duplicado se detecta por `error.code === '23505'` (codigo estandar de
 * PostgreSQL para violacion de restriccion unica), nunca por el nombre de la
 * restriccion: hay dos restricciones distintas que lo pueden disparar y no
 * vale la pena acoplarse a cual fue.
 *
 * @param {{ nombre: string, email: string, contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones] -
 *   `ejecutar` es el ejecutor de consultas inyectable para pruebas; sin el,
 *   `insertarUsuario` usa el pool real.
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
export async function registrar({ nombre, email, contrasena }, { ejecutar } = {}) {
  const contrasena_hash = await hashear(contrasena);

  let fila;
  try {
    fila = await insertarUsuario(
      { nombre, email: email.trim().toLowerCase(), contrasena_hash },
      ejecutar,
    );
  } catch (error) {
    if (error?.code === VIOLACION_UNICIDAD) {
      throw emailDuplicado();
    }
    throw error;
  }

  const usuario = { id: String(fila.id), nombre: fila.nombre, email: fila.email };
  return { token: firmar(usuario.id), usuario };
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
