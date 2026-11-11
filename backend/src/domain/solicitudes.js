import { noEncontrado, estadoInvalido } from './errores.js';
import { disponiblesDe } from './libros.js';
import { enTransaccion } from '../infra/transaccion.js';
import { bloquearLibroPropio } from '../data/libros.js';
import { bloquearPublicacion, buscarPublicacion } from '../data/publicaciones.js';
import { insertarSolicitud, buscarSolicitud, tienePendiente } from '../data/solicitudes.js';

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
 * Error de solicitud inexistente o de la que el usuario no es parte. Nunca
 * 403: no se confirma que exista.
 *
 * @returns {import('./errores.js').ErrorDominio} 404 NO_ENCONTRADO
 */
export function solicitudNoEncontrada() {
  return noEncontrado('No encontramos esa solicitud');
}
