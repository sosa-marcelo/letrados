import { noEncontrado, estadoInvalido, datosInvalidos, archivoDemasiadoGrande } from './errores.js';
import { disponiblesDe } from './libros.js';
import { enTransaccion } from '../infra/transaccion.js';
import { bloquearLibroPropio } from '../data/libros.js';
import { guardarFoto, borrarFoto, leerFoto } from '../data/fotos.js';
import {
  insertarPublicacion,
  bloquearPublicacionPropia,
  publicacionVigenteDeLibro,
  actualizarNota,
  cambiarEstadoPublicacion,
  buscarPublicacion,
} from '../data/publicaciones.js';

/**
 * Reglas de las publicaciones (modulo 4, epica LET-113, RF-14 a RF-16).
 *
 * Una publicacion ofrece UN ejemplar de un libro del catalogo. Un libro tiene
 * como maximo una publicacion vigente (`activa` o `reservada`). Esta capa
 * crea publicaciones y las mueve de `activa` a `retirada`; los pasos a
 * `reservada` y `cerrada` los da el modulo de solicitudes (epica LET-114).
 */

/** Reputacion de quien todavia no recibio valoraciones (RF-26). */
const SIN_VALORACIONES = { promedio: null, cantidad: 0 };

/**
 * @typedef {object} Publicacion
 * @property {string} id
 * @property {'activa' | 'reservada' | 'cerrada' | 'retirada'} estado
 * @property {string | null} nota
 * @property {boolean} tieneFoto
 * @property {{
 *   id: string, titulo: string, autor: string, editorial: string | null,
 *   anio: number | null, edicion: string | null, isbn: string | null,
 *   estadoConservacion: string | null, descripcion: string | null, disponible: number
 * }} libro - los datos del libro al dia, leidos del catalogo.
 * @property {{ id: string, nombre: string, reputacion: { promedio: number | null, cantidad: number } }} propietario
 * @property {boolean} esMia - si la publicacion es de quien consulta (false sin sesion).
 * @property {string} creadaEn
 */

/**
 * Forma publica de una publicacion. Explorar, el detalle y el perfil publico
 * usan la misma: los datos que no muestra un listado no cuestan una consulta
 * extra porque ya vienen en la fila.
 *
 * @param {import('../data/publicaciones.js').FilaPublicacionCompleta} fila
 * @param {{ usuarioId?: string | null, reputacion?: { promedio: number | null, cantidad: number } }} [contexto]
 * @returns {Publicacion}
 */
export function vistaPublicacion(fila, { usuarioId = null, reputacion = SIN_VALORACIONES } = {}) {
  return {
    id: String(fila.id),
    estado: fila.estado,
    nota: fila.nota ?? null,
    tieneFoto: Boolean(fila.tiene_foto),
    libro: {
      id: String(fila.libro_id),
      titulo: fila.titulo,
      autor: fila.autor,
      editorial: fila.editorial ?? null,
      anio: fila.anio_publicacion ?? null,
      edicion: fila.edicion ?? null,
      isbn: fila.isbn ?? null,
      estadoConservacion: fila.estado_conservacion ?? null,
      descripcion: fila.descripcion ?? null,
      disponible: disponiblesDe(fila),
    },
    propietario: {
      id: String(fila.usuario_id),
      nombre: fila.propietario_nombre,
      reputacion,
    },
    esMia: usuarioId != null && String(fila.usuario_id) === String(usuarioId),
    creadaEn: new Date(fila.creada_en).toISOString(),
  };
}

/**
 * Publica un libro propio (RF-14). En transaccion, con el libro bloqueado: no
 * archivado, con al menos un ejemplar disponible y sin otra publicacion
 * vigente.
 *
 * - Libro inexistente, ajeno o archivado -> 404 NO_ENCONTRADO.
 * - Sin ejemplares disponibles o ya publicado -> 409 ESTADO_INVALIDO.
 *
 * @param {string} usuarioId
 * @param {{ libroId: string, nota?: string | null }} datos - ya validados por la API.
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<Publicacion>}
 */
export async function publicar(usuarioId, { libroId, nota = null }, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const libro = await bloquearLibroPropio(libroId, usuarioId, tx);
      if (!libro) throw noEncontrado('No encontramos ese libro en tu catálogo');

      if (disponiblesDe(libro) < 1) {
        throw estadoInvalido('Ese libro no tiene ejemplares disponibles para publicar', [
          { campo: 'libroId', mensaje: 'Sin ejemplares disponibles' },
        ]);
      }
      if (await publicacionVigenteDeLibro(libroId, tx)) {
        throw estadoInvalido('Ese libro ya está publicado', [
          { campo: 'libroId', mensaje: 'Ya tiene una publicación vigente' },
        ]);
      }

      const { id } = await insertarPublicacion(
        { libro_id: libroId, usuario_id: usuarioId, nota },
        tx,
      );
      return vistaPublicacion(await buscarPublicacion(id, tx), { usuarioId });
    },
    { ejecutar },
  );
}

/**
 * Bloquea una publicacion propia que todavia se puede modificar: existe, es
 * de quien la pide y esta `activa`. Se usa dentro de una transaccion.
 *
 * - Inexistente o ajena -> 404 NO_ENCONTRADO (nunca 403).
 * - Reservada, cerrada o retirada -> 409 ESTADO_INVALIDO.
 *
 * @param {string} usuarioId
 * @param {string} publicacionId
 * @param {import('../data/publicaciones.js').Ejecutor} tx
 * @returns {Promise<import('../data/publicaciones.js').FilaPublicacion>}
 */
export async function bloquearPublicacionModificable(usuarioId, publicacionId, tx) {
  const publicacion = await bloquearPublicacionPropia(publicacionId, usuarioId, tx);
  if (!publicacion) throw publicacionNoEncontrada();
  if (publicacion.estado !== 'activa') {
    throw estadoInvalido(MOTIVO_NO_MODIFICABLE[publicacion.estado]);
  }
  return publicacion;
}

/** Por que una publicacion que no esta activa ya no se modifica. */
const MOTIVO_NO_MODIFICABLE = {
  reservada: 'La publicación tiene una solicitud aceptada y ya no se puede modificar',
  cerrada: 'La publicación está cerrada: el intercambio se completó',
  retirada: 'La publicación ya fue retirada',
};

/**
 * Reemplaza la nota de una publicacion propia y activa (RF-14). `null` la borra.
 *
 * @param {string} usuarioId
 * @param {string} publicacionId
 * @param {{ nota: string | null }} datos - ya validados por la API.
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<Publicacion>}
 */
export async function modificarNota(usuarioId, publicacionId, { nota }, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      await bloquearPublicacionModificable(usuarioId, publicacionId, tx);
      await actualizarNota(publicacionId, nota, tx);
      return vistaPublicacion(await buscarPublicacion(publicacionId, tx), { usuarioId });
    },
    { ejecutar },
  );
}

/**
 * Retira una publicacion propia y activa (RF-14): deja de verse en Explorar y
 * el libro queda libre para volver a publicarse.
 *
 * @param {string} usuarioId
 * @param {string} publicacionId
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<{ resultado: 'retirada' }>}
 */
export async function retirar(usuarioId, publicacionId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      await bloquearPublicacionModificable(usuarioId, publicacionId, tx);
      await cambiarEstadoPublicacion(publicacionId, 'retirada', tx);
      return { resultado: 'retirada' };
    },
    { ejecutar },
  );
}

/** Tipos de imagen admitidos para la foto (CHECK de la migracion 006). */
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** Tope de la foto: 2 MB. La API lo aplica al leer el cuerpo; aca se repite. */
export const BYTES_MAX_FOTO = 2 * 1024 * 1024;

/**
 * Sube o reemplaza la foto de una publicacion propia y activa (RF-14). Se
 * guarda en base64 (migracion 006).
 *
 * - Tipo no admitido o foto vacia -> 400 DATOS_INVALIDOS en el campo `foto`.
 * - Mas de 2 MB -> 413 ARCHIVO_DEMASIADO_GRANDE.
 *
 * @param {string} usuarioId
 * @param {string} publicacionId
 * @param {{ tipo: string, bytes: Buffer }} foto
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<Publicacion>}
 */
export async function subirFoto(usuarioId, publicacionId, { tipo, bytes }, { ejecutar } = {}) {
  if (!TIPOS_FOTO.includes(tipo) || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw datosInvalidos([{ campo: 'foto', mensaje: 'La foto tiene que ser una imagen JPEG, PNG o WebP' }]);
  }
  if (bytes.length > BYTES_MAX_FOTO) {
    throw archivoDemasiadoGrande('La foto supera el máximo de 2 MB');
  }

  return enTransaccion(
    async (tx) => {
      await bloquearPublicacionModificable(usuarioId, publicacionId, tx);
      await guardarFoto(publicacionId, { tipo, contenido: bytes.toString('base64') }, tx);
      return vistaPublicacion(await buscarPublicacion(publicacionId, tx), { usuarioId });
    },
    { ejecutar },
  );
}

/**
 * Quita la foto de una publicacion propia y activa (RF-14). Sin foto no es
 * error: el resultado es el mismo.
 *
 * @param {string} usuarioId
 * @param {string} publicacionId
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<Publicacion>}
 */
export async function quitarFoto(usuarioId, publicacionId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      await bloquearPublicacionModificable(usuarioId, publicacionId, tx);
      await borrarFoto(publicacionId, tx);
      return vistaPublicacion(await buscarPublicacion(publicacionId, tx), { usuarioId });
    },
    { ejecutar },
  );
}

/**
 * La foto de una publicacion, en cualquier estado (RF-16). Publica.
 *
 * @param {string} publicacionId
 * @param {{ ejecutar?: import('../data/publicaciones.js').Ejecutor }} [opciones]
 * @returns {Promise<{ tipo: string, bytes: Buffer }>} 404 si no tiene foto.
 */
export async function verFoto(publicacionId, { ejecutar } = {}) {
  const foto = await leerFoto(publicacionId, ejecutar);
  if (!foto) throw noEncontrado('Esa publicación no tiene foto');
  return { tipo: foto.tipo, bytes: Buffer.from(foto.contenido, 'base64') };
}

/**
 * Error de publicacion inexistente o ajena. Exportado para que la API
 * rechace ids mal formados con la misma respuesta.
 *
 * @returns {import('./errores.js').ErrorDominio} 404 NO_ENCONTRADO
 */
export function publicacionNoEncontrada() {
  return noEncontrado('No encontramos esa publicación');
}
