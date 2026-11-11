import { noEncontrado, estadoInvalido, accesoDenegado } from './errores.js';
import { disponiblesDe } from './libros.js';
import { calcularVencimiento } from './plazo.js';
import { enTransaccion } from '../infra/transaccion.js';
import { bloquearLibroPropio, bloquearLibro, moverEjemplar } from '../data/libros.js';
import {
  bloquearPublicacion,
  buscarPublicacion,
  cambiarEstadoPublicacion,
} from '../data/publicaciones.js';
import {
  insertarSolicitud,
  buscarSolicitud,
  tienePendiente,
  bloquearSolicitud,
  marcarAceptada,
  cerrarSolicitud,
  cerrarPendientesDePublicacion,
} from '../data/solicitudes.js';

/**
 * Reglas de las solicitudes e intercambios (modulo 4, epica LET-114, RF-17 a
 * RF-21).
 *
 * Una solicitud une el libro de una publicacion (el solicitado) con un libro
 * del solicitante (el ofrecido). Al aceptarse se vuelve un intercambio y
 * reserva un ejemplar de cada uno. Toda accion corre en una transaccion y
 * bloquea siempre en el mismo orden: solicitud, publicacion y los dos libros
 * por id ascendente, para no generar interbloqueos.
 */

/** Estados en los que una parte todavia puede cancelar (RF-20). */
const CANCELABLES = ['pendiente', 'aceptada', 'flagueada'];

/** Estados en los que se confirma la entrega (RF-21). */
const CONFIRMABLES = ['aceptada', 'flagueada'];

/**
 * @typedef {object} Solicitud
 * @property {string} id
 * @property {'pendiente' | 'aceptada' | 'rechazada' | 'cancelada' | 'completada' | 'flagueada'} estado
 * @property {boolean} soyPropietario - si quien mira es el dueño de la publicacion.
 * @property {string} publicacionId
 * @property {{ id: string, nombre: string }} contraparte
 * @property {{ id: string, titulo: string, autor: string }} libroSolicitado - el de la publicacion.
 * @property {{ id: string, titulo: string, autor: string }} libroOfrecido - el del solicitante.
 * @property {string | null} venceEn - plazo de confirmacion (RF-22).
 * @property {boolean} confirmadaPorMi
 * @property {boolean} confirmadaPorContraparte
 * @property {{ aceptar: boolean, rechazar: boolean, cancelar: boolean, confirmar: boolean, reportar: boolean, valorar: boolean }} puedo
 * @property {string} creadaEn
 */

/**
 * Que parte es el usuario en la solicitud, o null si no es parte.
 *
 * @param {{ propietario_id: string, solicitante_id: string }} fila
 * @param {string} usuarioId
 * @returns {'propietario' | 'solicitante' | null}
 */
export function parteDe(fila, usuarioId) {
  if (String(fila.propietario_id) === String(usuarioId)) return 'propietario';
  if (String(fila.solicitante_id) === String(usuarioId)) return 'solicitante';
  return null;
}

/**
 * Lo que el usuario puede hacer con la solicitud. Son las mismas reglas que
 * validan cada accion: la interfaz dibuja los botones con esto y no las repite.
 *
 * @param {import('../data/solicitudes.js').FilaSolicitudCompleta} fila
 * @param {string} usuarioId
 * @returns {Solicitud['puedo']}
 */
export function puedoCon(fila, usuarioId) {
  const parte = parteDe(fila, usuarioId);
  const confirmada =
    parte === 'propietario' ? fila.confirmada_propietario_en : fila.confirmada_solicitante_en;
  return {
    aceptar: parte === 'propietario' && fila.estado === 'pendiente',
    rechazar: parte === 'propietario' && fila.estado === 'pendiente',
    cancelar: parte !== null && CANCELABLES.includes(fila.estado),
    confirmar: parte !== null && CONFIRMABLES.includes(fila.estado) && !confirmada,
    // Llegan con sus epicas: reportes (LET-115) y valoraciones (LET-116).
    reportar: false,
    valorar: false,
  };
}

/**
 * Forma publica de una solicitud, vista por una de sus partes.
 *
 * @param {import('../data/solicitudes.js').FilaSolicitudCompleta} fila
 * @param {string} usuarioId
 * @returns {Solicitud}
 */
export function vistaSolicitud(fila, usuarioId) {
  const soyPropietario = parteDe(fila, usuarioId) === 'propietario';
  const fecha = (valor) => (valor ? new Date(valor).toISOString() : null);
  return {
    id: String(fila.id),
    estado: fila.estado,
    soyPropietario,
    publicacionId: String(fila.publicacion_id),
    contraparte: soyPropietario
      ? { id: String(fila.solicitante_id), nombre: fila.solicitante_nombre }
      : { id: String(fila.propietario_id), nombre: fila.propietario_nombre },
    libroSolicitado: {
      id: String(fila.libro_solicitado_id),
      titulo: fila.solicitado_titulo,
      autor: fila.solicitado_autor,
    },
    libroOfrecido: {
      id: String(fila.libro_ofrecido_id),
      titulo: fila.ofrecido_titulo,
      autor: fila.ofrecido_autor,
    },
    venceEn: fecha(fila.vence_en),
    confirmadaPorMi: Boolean(
      soyPropietario ? fila.confirmada_propietario_en : fila.confirmada_solicitante_en,
    ),
    confirmadaPorContraparte: Boolean(
      soyPropietario ? fila.confirmada_solicitante_en : fila.confirmada_propietario_en,
    ),
    puedo: puedoCon(fila, usuarioId),
    creadaEn: fecha(fila.creada_en),
  };
}

/**
 * Solicita una publicacion ajena ofreciendo un libro propio (RF-17, CU-20).
 * No reserva nada: la disponibilidad se vuelve a verificar al aceptar.
 *
 * - Publicacion inexistente -> 404 NO_ENCONTRADO.
 * - Propia, no activa, de una cuenta no activa o sin ejemplares -> 409.
 * - Libro ofrecido ajeno, archivado o sin disponibles -> 409.
 * - Ya hay una pendiente de esta persona sobre la publicacion -> 409.
 *
 * @param {string} usuarioId
 * @param {{ publicacionId: string, libroOfrecidoId: string }} datos - ya validados por la API.
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<Solicitud>}
 */
export async function solicitar(usuarioId, { publicacionId, libroOfrecidoId }, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const publicacion = await bloquearPublicacion(publicacionId, tx);
      if (!publicacion) throw noEncontrado('No encontramos esa publicación');
      if (String(publicacion.usuario_id) === String(usuarioId)) {
        throw estadoInvalido('No podés solicitar tu propia publicación');
      }

      const completa = await buscarPublicacion(publicacionId, tx);
      if (
        publicacion.estado !== 'activa' ||
        completa.propietario_estado !== 'activa' ||
        completa.libro_archivado_en ||
        disponiblesDe(completa) < 1
      ) {
        throw estadoInvalido('Esa publicación ya no está disponible');
      }

      const ofrecido = await bloquearLibroPropio(libroOfrecidoId, usuarioId, tx);
      if (!ofrecido) {
        throw estadoInvalido('Ese libro no está en tu catálogo', [
          { campo: 'libroOfrecidoId', mensaje: 'Elegí un libro de tu catálogo' },
        ]);
      }
      if (disponiblesDe(ofrecido) < 1) {
        throw estadoInvalido('Ese libro no tiene ejemplares disponibles para ofrecer', [
          { campo: 'libroOfrecidoId', mensaje: 'Sin ejemplares disponibles' },
        ]);
      }

      if (await tienePendiente(publicacionId, usuarioId, tx)) {
        throw estadoInvalido('Ya tenés una solicitud pendiente sobre esta publicación');
      }

      const { id } = await insertarSolicitud(
        { publicacion_id: publicacionId, solicitante_id: usuarioId, libro_ofrecido_id: libroOfrecidoId },
        tx,
      );
      return vistaSolicitud(await buscarSolicitud(id, tx), usuarioId);
    },
    { ejecutar },
  );
}

/**
 * Bloquea una solicitud de la que el usuario es parte y la devuelve completa.
 * Es el primer paso de toda accion: la solicitud es lo primero que se bloquea.
 *
 * - Inexistente o ajena -> 404 NO_ENCONTRADO (nunca 403).
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {import('../data/solicitudes.js').Ejecutor} tx
 * @returns {Promise<import('../data/solicitudes.js').FilaSolicitudCompleta>}
 */
export async function bloquearComoParte(usuarioId, solicitudId, tx) {
  if (!(await bloquearSolicitud(solicitudId, tx))) throw solicitudNoEncontrada();
  const fila = await buscarSolicitud(solicitudId, tx);
  if (!parteDe(fila, usuarioId)) throw solicitudNoEncontrada();
  return fila;
}

/**
 * Bloquea los dos libros de una solicitud en orden de id ascendente (el
 * orden fijo evita interbloqueos entre dos aceptaciones cruzadas).
 *
 * @param {import('../data/solicitudes.js').FilaSolicitudCompleta} fila
 * @param {import('../data/solicitudes.js').Ejecutor} tx
 * @returns {Promise<{ solicitado: import('../data/libros.js').FilaLibro, ofrecido: import('../data/libros.js').FilaLibro }>}
 */
export async function bloquearLibrosDe(fila, tx) {
  const ids = [fila.libro_solicitado_id, fila.libro_ofrecido_id].sort((a, b) => Number(a) - Number(b));
  const bloqueados = new Map();
  for (const id of ids) bloqueados.set(String(id), await bloquearLibro(id, tx));
  return {
    solicitado: bloqueados.get(String(fila.libro_solicitado_id)),
    ofrecido: bloqueados.get(String(fila.libro_ofrecido_id)),
  };
}

/**
 * Verifica que el dueño de la publicacion pueda resolver la solicitud.
 *
 * - El solicitante intenta aceptar o rechazar -> 403 ACCESO_DENEGADO.
 * - Ya no esta pendiente -> 409 ESTADO_INVALIDO.
 *
 * @param {import('../data/solicitudes.js').FilaSolicitudCompleta} fila
 * @param {string} usuarioId
 */
function exigirPendienteDelDuenio(fila, usuarioId) {
  if (parteDe(fila, usuarioId) !== 'propietario') {
    throw accesoDenegado('Solo quien publicó el libro puede aceptar o rechazar la solicitud');
  }
  if (fila.estado !== 'pendiente') {
    throw estadoInvalido('Esta solicitud ya no está pendiente');
  }
}

/**
 * Acepta una solicitud pendiente (RF-19, RF-22, CU-22). En una transaccion:
 * reserva un ejemplar de cada libro, deja la publicacion `reservada` (sale de
 * Explorar), rechaza las demas pendientes sobre ella y fija el plazo de
 * confirmacion.
 *
 * - Un libro se quedo sin ejemplares disponibles -> 409 nombrandolo, sin
 *   cambiar nada (CU-22 A2).
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor, ahora?: Date }} [opciones]
 * @returns {Promise<Solicitud>}
 */
export async function aceptar(usuarioId, solicitudId, { ejecutar, ahora = new Date() } = {}) {
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      exigirPendienteDelDuenio(fila, usuarioId);

      const publicacion = await bloquearPublicacion(fila.publicacion_id, tx);
      if (publicacion.estado !== 'activa') {
        throw estadoInvalido('La publicación ya no está disponible');
      }

      const { solicitado, ofrecido } = await bloquearLibrosDe(fila, tx);
      if (solicitado.archivado_en || disponiblesDe(solicitado) < 1) {
        throw estadoInvalido(`Ya no te quedan ejemplares disponibles de «${solicitado.titulo}»`, [
          { campo: 'libroSolicitado', mensaje: 'Sin ejemplares disponibles' },
        ]);
      }
      if (ofrecido.archivado_en || disponiblesDe(ofrecido) < 1) {
        throw estadoInvalido(`«${ofrecido.titulo}» ya no tiene ejemplares disponibles`, [
          { campo: 'libroOfrecido', mensaje: 'Sin ejemplares disponibles' },
        ]);
      }

      await moverEjemplar(solicitado.id, 'reservar', tx);
      await moverEjemplar(ofrecido.id, 'reservar', tx);
      await cambiarEstadoPublicacion(publicacion.id, 'reservada', tx);
      await cerrarPendientesDePublicacion(publicacion.id, 'rechazada', { excepto: solicitudId }, tx);
      await marcarAceptada(solicitudId, await calcularVencimiento(ahora, { ejecutar: tx }), tx);

      return vistaSolicitud(await buscarSolicitud(solicitudId, tx), usuarioId);
    },
    { ejecutar },
  );
}

/**
 * Rechaza una solicitud pendiente (RF-19, CU-22 A1). La publicacion sigue
 * disponible y las demas pendientes no cambian.
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<Solicitud>}
 */
export async function rechazar(usuarioId, solicitudId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      exigirPendienteDelDuenio(fila, usuarioId);
      await cerrarSolicitud(solicitudId, 'rechazada', {}, tx);
      return vistaSolicitud(await buscarSolicitud(solicitudId, tx), usuarioId);
    },
    { ejecutar },
  );
}

/**
 * Error de solicitud inexistente o de la que el usuario no es parte. Nunca
 * 403: no se confirma que exista.
 *
 * @returns {import('./errores.js').ErrorDominio} 404 NO_ENCONTRADO
 */
export function solicitudNoEncontrada() {
  return noEncontrado('No encontramos esa solicitud');
}
