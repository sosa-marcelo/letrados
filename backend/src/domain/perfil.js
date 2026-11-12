import { noEncontrado, contrasenaIncorrecta, sesionInvalida } from './errores.js';
import { enTransaccion } from '../infra/transaccion.js';
import { verificar as verificarContrasena, hashear } from '../infra/hash.js';
import {
  buscarUsuarioPorId,
  buscarHashDeUsuario,
  bloquearFilaUsuario,
  anonimizarUsuario,
  actualizarNombre,
  actualizarContrasena,
} from '../data/usuarios.js';
import { revocarSesionesDeUsuario } from '../data/sesiones.js';
import { archivarLibrosDeUsuario } from '../data/libros.js';
import { reputacionDe } from './reputacion.js';
import { vistaPublicacion } from './publicaciones.js';
import {
  publicacionesActivasDeUsuario,
  retirarPublicacionesDeUsuario,
} from '../data/publicaciones.js';
import {
  solicitudesAbiertasDeUsuario,
  bloquearSolicitud,
  buscarSolicitud,
} from '../data/solicitudes.js';
import { cancelarBloqueada } from './solicitudes.js';

/**
 * Perfil propio, perfil publico y baja de cuenta (modulo 2: RF-05, RF-08, RF-09).
 */

/** Nombre que muestra una cuenta dada de baja (RF-09). */
export const NOMBRE_CUENTA_ELIMINADA = 'Cuenta eliminada';

/** @typedef {import('./reputacion.js').Reputacion} Reputacion */

// La reputacion vive en `reputacion.js` desde LET-128; se reexporta para no
// romper a quien la importaba desde aca.
export { reputacionDe };

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
 *   la persona. Sus publicaciones no aparecen: Explorar tampoco las muestra.
 * - Publicaciones (LET-130): las mismas que Explorar mostraria de esta cuenta,
 *   con la forma de Explorar. Se ve como la ve cualquiera: `esMia` va en false.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ id: string, nombre: string, eliminada: boolean, reputacion: Reputacion, publicaciones: import('./publicaciones.js').Publicacion[] }>}
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

  const reputacion = await reputacionDe(String(fila.id), { ejecutar });
  const publicaciones = await publicacionesActivasDeUsuario(fila.id, ejecutar);
  return {
    id: String(fila.id),
    nombre: fila.nombre,
    eliminada: false,
    reputacion,
    publicaciones: publicaciones.map((p) => vistaPublicacion(p, { reputacion })),
  };
}

/**
 * Baja de cuenta (RF-09), despues de volver a autenticarse con la contrasena.
 * Todo en una sola transaccion: una baja a medias dejaria una cuenta sin datos
 * pero con reservas trabadas.
 *
 * ```
 * 1-3. Cancelar las solicitudes abiertas donde es parte (pendientes,
 *      aceptadas y flagueadas), liberar sus reservas y reactivar las
 *      publicaciones ajenas que habia reservado (LET-147).
 * 4.   Retirar sus publicaciones vigentes (LET-147).
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

      // 1-3. Cada solicitud abierta se cancela con la misma regla de RF-20,
      // bloqueada primero, como cualquier otra accion sobre una solicitud.
      for (const abierta of await solicitudesAbiertasDeUsuario(usuarioId, tx)) {
        await bloquearSolicitud(abierta.id, tx);
        await cancelarBloqueada(await buscarSolicitud(abierta.id, tx), usuarioId, tx);
      }
      // 4.
      await retirarPublicacionesDeUsuario(usuarioId, tx);

      await archivarLibrosDeUsuario(usuarioId, tx);
      await anonimizarUsuario(usuarioId, tx);
      await revocarSesionesDeUsuario(usuarioId, {}, tx);
    },
    { ejecutar },
  );
}

/**
 * Modifica el nombre del perfil propio (RF-05) y devuelve el perfil
 * actualizado, con la misma forma que verPerfil.
 *
 * @param {string} usuarioId
 * @param {{ nombre: string }} datos - ya validados por la API.
 * @param {{ ejecutar?: Function }} [opciones]
 */
export async function modificarNombre(usuarioId, { nombre }, { ejecutar } = {}) {
  const existe = await actualizarNombre(usuarioId, nombre, ejecutar);
  if (!existe) throw sesionInvalida();
  return verPerfil(usuarioId, { ejecutar });
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
