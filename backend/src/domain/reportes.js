import { estadoInvalido } from './errores.js';
import { bloquearComoParte, flaguearVencidas } from './solicitudes.js';
import { enTransaccion } from '../infra/transaccion.js';
import { insertarReporte } from '../data/reportes.js';

/**
 * Reportes de inconvenientes (RF-24, CU-26, LET-156). Cuando un intercambio
 * esta flagueado, cualquiera de las dos partes puede contar que paso, una o
 * mas veces. El administrador los lee junto al intercambio (LET-157).
 */

/**
 * @typedef {object} Reporte
 * @property {string} id
 * @property {{ id: string, nombre: string }} autor
 * @property {string} descripcion
 * @property {string} creadoEn
 */

/**
 * Forma publica de un reporte.
 *
 * @param {import('../data/reportes.js').FilaReporte} fila
 * @returns {Reporte}
 */
export function vistaReporte(fila) {
  return {
    id: String(fila.id),
    autor: { id: String(fila.autor_id), nombre: fila.autor_nombre },
    descripcion: fila.descripcion,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/**
 * Registra un reporte sobre un intercambio flagueado del que el usuario es
 * parte.
 *
 * - No es parte o no existe -> 404 NO_ENCONTRADO.
 * - No esta flagueado -> 409 ESTADO_INVALIDO.
 *
 * @param {string} usuarioId
 * @param {string} solicitudId
 * @param {{ descripcion: string }} datos - ya validados por la API.
 * @param {{ ejecutar?: import('../data/reportes.js').Ejecutor }} [opciones]
 * @returns {Promise<Reporte>}
 */
export async function reportar(usuarioId, solicitudId, { descripcion }, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  return enTransaccion(
    async (tx) => {
      const fila = await bloquearComoParte(usuarioId, solicitudId, tx);
      if (fila.estado !== 'flagueada') {
        throw estadoInvalido('Solo se reporta un intercambio flagueado');
      }
      return vistaReporte(
        await insertarReporte({ solicitud_id: solicitudId, autor_id: usuarioId, descripcion }, tx),
      );
    },
    { ejecutar },
  );
}
