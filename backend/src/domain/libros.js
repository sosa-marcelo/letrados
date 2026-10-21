import { noEncontrado, estadoInvalido } from './errores.js';
import { enTransaccion } from '../infra/transaccion.js';
import {
  insertarLibro,
  bloquearLibroPropio,
  actualizarLibro,
  archivarLibro,
  borrarLibro,
  contarEstorbosDeRetiro,
  tieneIntercambiosCompletados,
  listarLibrosDeUsuario,
} from '../data/libros.js';

/**
 * Reglas del catalogo de libros (modulo 3, RF-10 a RF-13).
 *
 * Un libro es un titulo con una cantidad. De la fila salen tres numeros:
 * `total` (lo que declara la persona), `reservada` (comprometida en
 * intercambios aceptados, la mueve solo el modulo 4) y `disponible`, que se
 * calcula y nunca se guarda. Este modulo **nunca escribe** `cantidad_reservada`.
 */

/** Tope de `porPagina` (DISENIO-GENERAL §7.1): un valor mayor se recorta. */
export const POR_PAGINA_MAX = 50;
const POR_PAGINA_DEFECTO = 20;

/**
 * @typedef {object} Libro
 * @property {string} id
 * @property {string} titulo
 * @property {string} autor
 * @property {number} total
 * @property {number} reservada
 * @property {number} disponible
 * @property {boolean} publicado - si tiene una publicacion activa (modulo 4; hoy siempre false).
 * @property {boolean} tieneHistorial - si participo en intercambios completados (decide el texto del retiro).
 * @property {string} creadoEn
 */

/**
 * Ejemplares disponibles de un libro: total menos reservada. Es la regla de
 * RF-13 que tambien usa el modulo 4 al publicar (RF-14) y al ofrecer (RF-17);
 * vive aca para escribirse una sola vez.
 *
 * @param {{ cantidad_total: number, cantidad_reservada: number }} libro
 * @returns {number}
 */
export function disponiblesDe(libro) {
  return libro.cantidad_total - libro.cantidad_reservada;
}

/**
 * Forma publica de una fila de `libros`.
 *
 * @param {import('../data/libros.js').FilaLibro} fila
 * @param {{ publicado?: boolean, tieneHistorial?: boolean }} [extra]
 * @returns {Libro}
 */
export function vistaLibro(fila, { publicado = false, tieneHistorial = false } = {}) {
  return {
    id: String(fila.id),
    titulo: fila.titulo,
    autor: fila.autor,
    total: fila.cantidad_total,
    reservada: fila.cantidad_reservada,
    disponible: disponiblesDe(fila),
    publicado,
    tieneHistorial,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/**
 * Alta de un libro (RF-10). La entrada ya viene validada por la API
 * (titulo y autor recortados, cantidad entera >= 1). No hay unicidad por
 * titulo: dos «Rayuela» del mismo dueño son legitimas (otra edicion, otro estado).
 *
 * @param {string} usuarioId
 * @param {{ titulo: string, autor: string, cantidad: number }} datos
 * @param {{ ejecutar?: import('../data/libros.js').Ejecutor }} [opciones]
 * @returns {Promise<Libro>}
 */
export async function agregarLibro(usuarioId, { titulo, autor, cantidad }, { ejecutar } = {}) {
  const fila = await insertarLibro(
    { usuario_id: usuarioId, titulo, autor, cantidad_total: cantidad },
    ejecutar,
  );
  return vistaLibro(fila);
}

/**
 * Modificacion de un libro propio (RF-11). En transaccion y con la fila
 * bloqueada: la cantidad nueva no puede quedar por debajo de los ejemplares
 * reservados, y el mensaje dice cual es el minimo.
 *
 * - No existe, es de otro o esta archivado -> 404 NO_ENCONTRADO.
 * - `cantidad < cantidad_reservada` -> 409 ESTADO_INVALIDO con el numero.
 *
 * @param {string} usuarioId
 * @param {string} libroId
 * @param {{ titulo: string, autor: string, cantidad: number }} datos
 * @param {{ ejecutar?: import('../data/libros.js').Ejecutor }} [opciones]
 * @returns {Promise<Libro>}
 */
export async function modificarLibro(
  usuarioId,
  libroId,
  { titulo, autor, cantidad },
  { ejecutar } = {},
) {
  return enTransaccion(
    async (tx) => {
      const libro = await bloquearLibroPropio(libroId, usuarioId, tx);
      if (!libro) throw libroNoEncontrado();

      const minimo = libro.cantidad_reservada;
      if (cantidad < minimo) {
        throw estadoInvalido(
          `Tenes ${minimo} ${minimo === 1 ? 'ejemplar reservado' : 'ejemplares reservados'} en intercambios aceptados. No podes bajar de ${minimo}.`,
          [{ campo: 'cantidad', mensaje: `El minimo es ${minimo}` }],
        );
      }

      const fila = await actualizarLibro(
        libroId,
        { titulo, autor, cantidad_total: cantidad },
        tx,
      );
      return vistaLibro(fila);
    },
    { ejecutar },
  );
}

/**
 * Retiro de un libro propio (RF-12). Tres desenlaces:
 *
 * 1. Tiene publicaciones activas o solicitudes abiertas -> 409 ESTADO_INVALIDO,
 *    enumerando lo que estorba en `detalles`.
 * 2. Participo en intercambios completados -> se ARCHIVA (la fila queda para
 *    el historial de la contraparte).
 * 3. Nada de lo anterior -> se BORRA.
 *
 * @param {string} usuarioId
 * @param {string} libroId
 * @param {{ ejecutar?: import('../data/libros.js').Ejecutor }} [opciones]
 * @returns {Promise<{ resultado: 'archivado' | 'eliminado' }>}
 */
export async function retirarLibro(usuarioId, libroId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const libro = await bloquearLibroPropio(libroId, usuarioId, tx);
      if (!libro) throw libroNoEncontrado();

      const { publicaciones, intercambios } = await contarEstorbosDeRetiro(libroId, tx);
      if (publicaciones > 0 || intercambios > 0) {
        const detalles = [];
        if (publicaciones > 0) {
          detalles.push({ mensaje: `Tiene ${publicaciones} publicacion(es) activa(s)` });
        }
        if (intercambios > 0) {
          detalles.push({ mensaje: `Participa en ${intercambios} solicitud(es) en curso` });
        }
        throw estadoInvalido(
          'No podes retirar este libro mientras tenga publicaciones o solicitudes activas',
          detalles,
        );
      }

      if (await tieneIntercambiosCompletados(libroId, tx)) {
        await archivarLibro(libroId, tx);
        return { resultado: 'archivado' };
      }

      await borrarLibro(libroId, tx);
      return { resultado: 'eliminado' };
    },
    { ejecutar },
  );
}

/**
 * Consulta del catalogo propio (RF-13), sin archivados, del mas nuevo al mas
 * viejo, con busqueda por subcadena en titulo o autor. `pagina` y `porPagina`
 * fuera de rango se recortan, no son error.
 *
 * @param {string} usuarioId
 * @param {{ q?: string, pagina?: number, porPagina?: number }} filtro
 * @param {{ ejecutar?: import('../data/libros.js').Ejecutor }} [opciones]
 * @returns {Promise<{ datos: Libro[], paginacion: { pagina: number, porPagina: number, total: number } }>}
 */
export async function listarLibros(usuarioId, { q, pagina, porPagina } = {}, { ejecutar } = {}) {
  const pag = recortar(pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tam = recortar(porPagina, 1, POR_PAGINA_MAX, POR_PAGINA_DEFECTO);
  const busqueda = typeof q === 'string' ? q.trim() : '';

  const { filas, total } = await listarLibrosDeUsuario(
    usuarioId,
    { q: busqueda || undefined, limite: tam, desplazamiento: (pag - 1) * tam },
    ejecutar,
  );

  return {
    datos: filas.map((fila) => vistaLibro(fila)),
    paginacion: { pagina: pag, porPagina: tam, total },
  };
}

/**
 * Error de libro inexistente o ajeno. Exportado para que la API rechace ids
 * mal formados con la misma respuesta.
 *
 * @returns {import('./errores.js').ErrorDominio} 404 NO_ENCONTRADO
 */
export function libroNoEncontrado() {
  return noEncontrado('No encontramos ese libro en tu catalogo');
}

/** Entero dentro de [min, max]; si no es un numero, el valor por defecto. */
function recortar(valor, min, max, defecto) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return defecto;
  return Math.min(Math.max(n, min), max);
}
