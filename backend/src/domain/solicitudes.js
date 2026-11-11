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
  marcarConfirmacion,
  listarSolicitudesDe,
  flaguearVencidas as flaguearVencidasEnLaBase,
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

/** Motivo fijo del flagueo (RF-23). */
export const MOTIVO_FLAGUEO = 'Venció el plazo de confirmación sin la confirmación de ambas partes';

/**
 * El temporizador de CU-25 (LET-155). Vercel no corre procesos de fondo y su
 * cron no baja de un minuto, asi que el plazo de 10 segundos de la demo no se
 * cumpliria con un cron: en su lugar, antes de listar, ver o actuar sobre
 * solicitudes (y de listar los flagueados) corre este barrido. Nadie puede
 * ver una solicitud vencida sin flaguear.
 *
 * Corre fuera de la transaccion de la accion: es un UPDATE idempotente y asi
 * no se mezcla con el orden de bloqueos de la accion.
 *
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<number>} cuantas flagueo.
 */
export async function flaguearVencidas({ ejecutar } = {}) {
  return flaguearVencidasEnLaBase(MOTIVO_FLAGUEO, ejecutar);
}

/** Todos los estados de una solicitud, para el filtro del listado. */
export const ESTADOS = ['pendiente', 'aceptada', 'rechazada', 'cancelada', 'completada', 'flagueada'];

/** Tope de `porPagina` en el listado, como en el resto de la API. */
export const POR_PAGINA_MAX = 50;
const POR_PAGINA_DEFECTO = 20;

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
 * @property {string | null} flagueadaEn - cuando vencio sin las dos confirmaciones (RF-23).
 * @property {string | null} motivoFlagueo
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
    flagueadaEn: fecha(fila.flagueada_en),
    motivoFlagueo: fila.motivo_flagueo ?? null,
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
  await flaguearVencidas({ ejecutar });
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
  await flaguearVencidas({ ejecutar });
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
 * Cancela una operacion (RF-20, CU-23): cualquiera de las partes, mientras
 * la solicitud este pendiente, aceptada o flagueada. Si ya habia reservas
 * (aceptada o flagueada), libera un ejemplar de cada libro y devuelve la
 * publicacion a `activa`, otra vez en Explorar. Guarda quien cancelo.
 *
 * - Rechazada, cancelada o completada -> 409 ESTADO_INVALIDO.
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<Solicitud>}
 */
export async function cancelar(usuarioId, solicitudId, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      await cancelarBloqueada(fila, usuarioId, tx);
      return vistaSolicitud(await buscarSolicitud(solicitudId, tx), usuarioId);
    },
    { ejecutar },
  );
}

/**
 * El cuerpo de `cancelar` sobre una solicitud ya bloqueada. Lo reusa la baja
 * de cuenta (RF-09), que cancela varias dentro de su propia transaccion.
 *
 * @param {import('../data/solicitudes.js').FilaSolicitudCompleta} fila
 * @param {string} usuarioId - quien cancela.
 * @param {import('../data/solicitudes.js').Ejecutor} tx
 */
export async function cancelarBloqueada(fila, usuarioId, tx) {
  if (!CANCELABLES.includes(fila.estado)) {
    throw estadoInvalido('Esta solicitud ya no se puede cancelar');
  }

  if (fila.estado !== 'pendiente') {
    const publicacion = await bloquearPublicacion(fila.publicacion_id, tx);
    const { solicitado, ofrecido } = await bloquearLibrosDe(fila, tx);
    await moverEjemplar(solicitado.id, 'liberar', tx);
    await moverEjemplar(ofrecido.id, 'liberar', tx);
    if (publicacion.estado === 'reservada') {
      await cambiarEstadoPublicacion(publicacion.id, 'activa', tx);
    }
  }

  await cerrarSolicitud(fila.id, 'cancelada', { canceladaPor: usuarioId }, tx);
}

/**
 * Confirma que el intercambio se concreto (RF-21, CU-24). Cada parte confirma
 * una vez, en `aceptada` o `flagueada` (el flagueo avisa, no congela). Con las
 * dos confirmaciones, en la misma transaccion: `completada`, descuenta un
 * ejemplar de cada libro (total y reservada) y cierra la publicacion.
 *
 * - No aceptada ni flagueada -> 409. Confirmar dos veces -> 409.
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<Solicitud>}
 */
export async function confirmar(usuarioId, solicitudId, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      if (!CONFIRMABLES.includes(fila.estado)) {
        throw estadoInvalido('Solo se confirma un intercambio aceptado');
      }
      const parte = parteDe(fila, usuarioId);
      const yaConfirmo =
        parte === 'propietario' ? fila.confirmada_propietario_en : fila.confirmada_solicitante_en;
      if (yaConfirmo) throw estadoInvalido('Ya confirmaste este intercambio');

      const confirmada = await marcarConfirmacion(solicitudId, parte, tx);
      if (confirmada.confirmada_propietario_en && confirmada.confirmada_solicitante_en) {
        const publicacion = await bloquearPublicacion(fila.publicacion_id, tx);
        const { solicitado, ofrecido } = await bloquearLibrosDe(fila, tx);
        await moverEjemplar(solicitado.id, 'descontar', tx);
        await moverEjemplar(ofrecido.id, 'descontar', tx);
        await cambiarEstadoPublicacion(publicacion.id, 'cerrada', tx);
        await cerrarSolicitud(solicitudId, 'completada', {}, tx);
      }

      return vistaSolicitud(await buscarSolicitud(solicitudId, tx), usuarioId);
    },
    { ejecutar },
  );
}

/**
 * Solicitudes del usuario (RF-18, CU-21): las `recibidas` sobre sus
 * publicaciones (default) o las `enviadas`, de la mas nueva a la mas vieja.
 * Un `estado` que no existe se ignora; `pagina` y `porPagina` fuera de rango
 * se recortan, no son error.
 *
 * @param {string} usuarioId
 * @param {{ rol?: string, estado?: string, pagina?: number | string, porPagina?: number | string }} filtro
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<{ datos: Solicitud[], paginacion: { pagina: number, porPagina: number, total: number } }>}
 */
export async function listar(usuarioId, { rol, estado, pagina, porPagina } = {}, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  const pag = recortar(pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tam = recortar(porPagina, 1, POR_PAGINA_MAX, POR_PAGINA_DEFECTO);
  const { filas, total } = await listarSolicitudesDe(
    usuarioId,
    {
      rol: rol === 'enviadas' ? 'enviadas' : 'recibidas',
      estado: ESTADOS.includes(estado) ? estado : undefined,
      limite: tam,
      desplazamiento: (pag - 1) * tam,
    },
    ejecutar,
  );
  return {
    datos: filas.map((fila) => vistaSolicitud(fila, usuarioId)),
    paginacion: { pagina: pag, porPagina: tam, total },
  };
}

/**
 * Una solicitud, vista por una de sus partes (RF-18).
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ ejecutar?: import('../data/solicitudes.js').Ejecutor }} [opciones]
 * @returns {Promise<Solicitud>} 404 si no existe o no es parte.
 */
export async function ver(usuarioId, solicitudId, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  const fila = await buscarSolicitud(solicitudId, ejecutar);
  if (!fila || !parteDe(fila, usuarioId)) throw solicitudNoEncontrada();
  return vistaSolicitud(fila, usuarioId);
}

/** Entero dentro de [min, max]; si no es un numero, el valor por defecto. */
function recortar(valor, min, max, defecto) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return defecto;
  return Math.min(Math.max(n, min), max);
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
