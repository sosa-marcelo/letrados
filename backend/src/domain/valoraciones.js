import { estadoInvalido, noEncontrado } from './errores.js';
import { bloquearComoParte, parteDe } from './solicitudes.js';
import { enTransaccion } from '../infra/transaccion.js';
import { insertarValoracion, valoracionDe, valoracionesRecibidas } from '../data/valoraciones.js';
import { buscarUsuarioPorId } from '../data/usuarios.js';

/**
 * Valoraciones (modulo 5, epica LET-116, RF-25, CU-28). Despues de completar
 * un intercambio, cada parte valora una sola vez a la otra, con un puntaje
 * entero de 1 a 5 y un comentario opcional. No se editan ni se borran.
 */

/**
 * @typedef {object} Valoracion
 * @property {string} id
 * @property {number} puntaje
 * @property {string | null} comentario
 * @property {string} creadaEn
 */

/**
 * Forma publica de una valoracion recien creada.
 *
 * @param {import('../data/valoraciones.js').FilaValoracion} fila
 * @returns {Valoracion}
 */
export function vistaValoracion(fila) {
  return {
    id: String(fila.id),
    puntaje: fila.puntaje,
    comentario: fila.comentario ?? null,
    creadaEn: new Date(fila.creada_en).toISOString(),
  };
}

/** El mensaje de la valoracion repetida, el mismo para los dos caminos. */
const YA_VALORADA = 'Ya valoraste este intercambio';

/**
 * Valora a la contraparte de un intercambio completado (RF-25, CU-28).
 *
 * - No es parte o no existe -> 404 NO_ENCONTRADO.
 * - No esta completado -> 409 ESTADO_INVALIDO (CU-28 A1).
 * - Ya lo valoro -> 409 «Ya valoraste este intercambio» (CU-28 A3). Si dos
 *   envios llegan a la vez, el UNIQUE de la base hace chocar al segundo y la
 *   respuesta es la misma (CU-28 E1).
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ puntaje: number, comentario?: string | null }} datos - ya validados por la API.
 * @param {{ ejecutar?: import('../data/valoraciones.js').Ejecutor }} [opciones]
 * @returns {Promise<Valoracion>}
 */
export async function valorar(usuarioId, solicitudId, { puntaje, comentario = null }, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      if (fila.estado !== 'completada') {
        throw estadoInvalido('Solo se valora un intercambio completado');
      }
      if (await valoracionDe(solicitudId, usuarioId, tx)) throw estadoInvalido(YA_VALORADA);

      const valorado = parteDe(fila, usuarioId) === 'propietario' ? fila.solicitante_id : fila.propietario_id;
      try {
        return vistaValoracion(
          await insertarValoracion(
            { solicitud_id: solicitudId, autor_id: usuarioId, valorado_id: valorado, puntaje, comentario },
            tx,
          ),
        );
      } catch (error) {
        if (error?.code === '23505') throw estadoInvalido(YA_VALORADA);
        throw error;
      }
    },
    { ejecutar },
  );
}

/** Tope de `porPagina`, como en el resto de la API. */
const POR_PAGINA_MAX = 50;
const POR_PAGINA_DEFECTO = 10;

/**
 * Valoraciones que recibio un usuario, para su perfil publico (RF-27,
 * CU-29): puntaje, comentario, quien la escribio y el intercambio que la
 * habilito, de la mas nueva a la mas vieja. Publico.
 *
 * - Cuenta inexistente -> 404. Una cuenta eliminada responde vacio, igual
 *   que su perfil publico.
 *
 * @param {string} usuarioId - la cuenta valorada.
 * @param {{ pagina?: number | string, porPagina?: number | string }} filtro
 * @param {{ ejecutar?: import('../data/valoraciones.js').Ejecutor }} [opciones]
 * @returns {Promise<{ datos: object[], paginacion: { pagina: number, porPagina: number, total: number } }>}
 */
export async function listarRecibidas(usuarioId, { pagina, porPagina } = {}, { ejecutar } = {}) {
  const cuenta = await buscarUsuarioPorId(usuarioId, ejecutar);
  if (!cuenta) throw noEncontrado('No encontramos esa cuenta');
  const pag = recortar(pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tam = recortar(porPagina, 1, POR_PAGINA_MAX, POR_PAGINA_DEFECTO);
  if (cuenta.estado === 'eliminada') {
    return { datos: [], paginacion: { pagina: pag, porPagina: tam, total: 0 } };
  }

  const { filas, total } = await valoracionesRecibidas(
    usuarioId,
    { limite: tam, desplazamiento: (pag - 1) * tam },
    ejecutar,
  );
  return {
    datos: filas.map((f) => ({
      ...vistaValoracion(f),
      autor: { id: String(f.autor_id), nombre: f.autor_nombre },
      intercambio: {
        id: String(f.solicitud_id),
        libroSolicitado: { titulo: f.solicitado_titulo },
        libroOfrecido: { titulo: f.ofrecido_titulo },
      },
    })),
    paginacion: { pagina: pag, porPagina: tam, total },
  };
}

/** Entero dentro de [min, max]; si no es un numero, el valor por defecto. */
function recortar(valor, min, max, defecto) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return defecto;
  return Math.min(Math.max(n, min), max);
}
