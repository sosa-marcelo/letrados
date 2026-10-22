import { noEncontrado, contrasenaIncorrecta, sesionInvalida } from './errores.js';
import { enTransaccion } from '../infra/transaccion.js';
import { verificar as verificarContrasena, hashear } from '../infra/hash.js';
import {
  buscarUsuarioPorId,
  buscarHashDeUsuario,
  bloquearFilaUsuario,
  anonimizarUsuario,
  actualizarContrasena,
} from '../data/usuarios.js';
import { revocarSesionesDeUsuario } from '../data/sesiones.js';
import { archivarLibrosDeUsuario } from '../data/libros.js';

/**
 * Perfil propio, perfil publico y baja de cuenta (modulo 2: RF-05, RF-08, RF-09).
 */

/** Nombre que muestra una cuenta dada de baja (RF-09). */
export const NOMBRE_CUENTA_ELIMINADA = 'Cuenta eliminada';

/**
 * @typedef {{ promedio: number | null, cantidad: number }} Reputacion
 */

/**
 * Reputacion de un usuario (RF-26). Las valoraciones llegan con el modulo 5
 * (fuera del alcance del ciclo 2): hasta entonces nadie tiene valoraciones y
 * la pantalla muestra «Sin valoraciones».
 *
 * @param {string} _usuarioId
 * @returns {Promise<Reputacion>}
 */
export async function reputacionDe(_usuarioId) {
  return { promedio: null, cantidad: 0 };
}

/**
 * Perfil propio (RF-05). Es el unico lugar donde el correo sale de la API, y
 * solo para su dueño.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ id: string, nombre: string, email: string, rol: string, creadoEn: string, reputacion: Reputacion }>}
 */
export async function verPerfil(usuarioId, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorId(usuarioId, ejecutar);
  if (!fila) throw sesionInvalida();
  return {
    id: String(fila.id),
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
    creadoEn: new Date(fila.creado_en).toISOString(),
    reputacion: await reputacionDe(String(fila.id)),
  };
}

/**
 * Perfil publico (RF-08): nombre, reputacion y publicaciones activas. Nunca el
 * correo, el rol, el estado ni fechas internas.
 *
 * - Cuenta eliminada (RF-09): 200 con «Cuenta eliminada», reputacion en cero y
 *   sin publicaciones. Un 404 romperia los enlaces del historial de terceros.
 * - Cuenta bloqueada: se muestra igual; el bloqueo impide el acceso, no borra a
 *   la persona.
 * - Las publicaciones llegan con el modulo 4: hasta entonces la lista es vacia.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ id: string, nombre: string, eliminada: boolean, reputacion: Reputacion, publicaciones: object[] }>}
 */
export async function perfilPublico(usuarioId, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorId(usuarioId, ejecutar);
  if (!fila) throw noEncontrado('No encontramos esa cuenta');

  if (fila.estado === 'eliminada') {
    return {
      id: String(fila.id),
      nombre: NOMBRE_CUENTA_ELIMINADA,
      eliminada: true,
      reputacion: { promedio: null, cantidad: 0 },
      publicaciones: [],
    };
  }

  return {
    id: String(fila.id),
    nombre: fila.nombre,
    eliminada: false,
    reputacion: await reputacionDe(String(fila.id)),
    publicaciones: [],
  };
}

/**
 * Baja de cuenta (RF-09), despues de volver a autenticarse con la contrasena.
 * Todo en una sola transaccion: una baja a medias dejaria una cuenta sin datos
 * pero con reservas trabadas.
 *
 * ```
 * 1-3. Cancelar intercambios no completados, liberar reservas y reactivar
 *      publicaciones ajenas.            <- modulo 4, fuera del ciclo 2
 * 4.   Retirar publicaciones propias.   <- modulo 4, fuera del ciclo 2
 * 5.   Archivar los libros propios (no se borran: el historial los nombra).
 * 6.   Anonimizar la fila de usuarios (nombre, correo .invalid, hash inutil).
 * 7.   Revocar todas sus sesiones.
 * ```
 *
 * Se anonimiza y no se borra: un DELETE arrastraria en cascada el historial y
 * las valoraciones de terceros. El correo original no se libera.
 *
 * @param {string} usuarioId
 * @param {{ contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<void>}
 */
export async function darDeBaja(usuarioId, { contrasena }, { ejecutar } = {}) {
  const hash = await buscarHashDeUsuario(usuarioId, ejecutar);
  if (!hash) throw sesionInvalida();
  if (!(await verificarContrasena(contrasena, hash))) throw contrasenaIncorrecta();

  await enTransaccion(
    async (tx) => {
      const fila = await bloquearFilaUsuario(usuarioId, tx);
      if (!fila || fila.estado === 'eliminada') throw sesionInvalida();

      await archivarLibrosDeUsuario(usuarioId, tx);
      await anonimizarUsuario(usuarioId, tx);
      await revocarSesionesDeUsuario(usuarioId, {}, tx);
    },
    { ejecutar },
  );
}

/**
 * Cambio de contrasena desde el perfil (RF-05). Pide la contrasena actual,
 * guarda el hash nuevo y revoca todas las demas sesiones en una sola
 * transaccion.
 *
 * @param {{ id: string, jti: string }} usuario
 * @param {{ contrasenaActual: string, contrasenaNueva: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<void>}
 */
export async function cambiarContrasena(
  { id, jti },
  { contrasenaActual, contrasenaNueva },
  { ejecutar } = {},
) {
  const hashActual = await buscarHashDeUsuario(id, ejecutar);
  if (!hashActual) throw sesionInvalida();
  if (!(await verificarContrasena(contrasenaActual, hashActual))) {
    throw contrasenaIncorrecta();
  }
  const hashNuevo = await hashear(contrasenaNueva);
  await enTransaccion(
    async (tx) => {
      await actualizarContrasena(id, hashNuevo, tx);
      await revocarSesionesDeUsuario(id, { excepto: jti }, tx);
    },
    { ejecutar },
  );
}
