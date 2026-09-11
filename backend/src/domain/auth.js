import { noImplementado, emailDuplicado, credencialesInvalidas, sesionInvalida } from './errores.js';
import { hashear, verificar as verificarContrasena } from '../infra/hash.js';
import { firmar } from '../infra/jwt.js';
import { insertarUsuario, buscarUsuarioPorEmail, buscarUsuarioPorId } from '../data/usuarios.js';

/**
 * Hash bcrypt de coste 12 de un valor descartable (un UUID al azar, generado
 * una sola vez). No es un secreto de nadie: solo sirve para que
 * `verificarContrasena` tenga algo con que comparar cuando el correo no
 * existe, y asi la respuesta tarde lo mismo exista o no la cuenta (ver
 * `iniciarSesion`). Coste 12 porque un coste menor comparara mas rapido que
 * el hash real y el tiempo volveria a delatar cuentas.
 */
const HASH_FICTICIO = '$2b$12$tteIclI8DI10MR5pEIt3W.1Dzjp9uTqpZzV8WB6jDXhX9GGWCUv2S';

/**
 * Reglas de negocio de autenticacion.
 *
 * LET-18 congelo el contrato: cada funcion existe con su firma definitiva.
 * LET-14 y LET-15 quedan pendientes y siguen lanzando `NO_IMPLEMENTADO` (501).
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
 * `CREDENCIALES_INVALIDAS`, siempre con el mismo mensaje: nunca distingue si
 * fallo el correo o la contrasena.
 *
 * Compara la contrasena aunque el usuario no exista (contra `HASH_FICTICIO`):
 * asi las dos respuestas de error tardan lo mismo. Si solo se comparara cuando
 * el usuario existe, el tiempo de respuesta delataria que correos estan
 * registrados.
 *
 * @param {{ email: string, contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
export async function iniciarSesion({ email, contrasena }, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorEmail(email.trim().toLowerCase(), ejecutar);

  // Se compara aunque el usuario no exista, para que las dos respuestas
  // de error tarden lo mismo: si no, el tiempo delata que cuentas existen.
  const coincide = await verificarContrasena(contrasena, fila?.contrasena_hash ?? HASH_FICTICIO);
  if (!fila || !coincide) throw credencialesInvalidas();

  const usuario = { id: String(fila.id), nombre: fila.nombre, email: fila.email };
  return { token: firmar(usuario.id), usuario };
}

/**
 * Devuelve los datos publicos del usuario de la sesion actual. El id ya viene
 * validado por el middleware `autenticar` (sale del `sub` del JWT); si de
 * todos modos no corresponde a nadie (usuario borrado, por ejemplo), la sesion
 * se trata como invalida.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ id: string, nombre: string, email: string }>}
 */
export async function usuarioActual(usuarioId, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorId(usuarioId, ejecutar);
  if (!fila) throw sesionInvalida();
  return { id: String(fila.id), nombre: fila.nombre, email: fila.email };
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
