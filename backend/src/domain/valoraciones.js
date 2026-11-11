import { estadoInvalido } from './errores.js';
import { bloquearComoParte, parteDe } from './solicitudes.js';
import { enTransaccion } from '../infra/transaccion.js';
import { insertarValoracion, valoracionDe } from '../data/valoraciones.js';

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
