import { reputacionesDeUsuarios } from '../data/valoraciones.js';

/**
 * Reputacion de los usuarios (RF-26). Vive en su propio modulo porque la usan
 * el perfil y las publicaciones: si estuviera en `perfil.js`, perfil y
 * publicaciones se importarian en circulo (LET-128).
 */

/**
 * @typedef {{ promedio: number | null, cantidad: number }} Reputacion
 */

/** Reputacion de quien no recibio valoraciones. */
export const SIN_VALORACIONES = Object.freeze({ promedio: null, cantidad: 0 });

/**
 * Reputacion de varios usuarios a la vez, para un listado entero con una sola
 * consulta. Todo id pedido aparece en el mapa.
 *
 * @param {string[]} usuarioIds
 * @param {{ ejecutar?: Function }} [opciones]
 * @returns {Promise<Map<string, Reputacion>>}
 */
export async function reputacionesDe(usuarioIds, { ejecutar } = {}) {
  const filas = await reputacionesDeUsuarios(usuarioIds, ejecutar);
  const porId = new Map(
    filas.map((fila) => [
      String(fila.valorado_id),
      // avg() llega como texto en PostgreSQL real; Number() hace falta antes de redondear.
      { promedio: Math.round(Number(fila.promedio) * 10) / 10, cantidad: fila.cantidad },
    ]),
  );
  return new Map(usuarioIds.map((id) => [String(id), porId.get(String(id)) ?? { ...SIN_VALORACIONES }]));
}

/**
 * Reputacion de un usuario.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: Function }} [opciones]
 * @returns {Promise<Reputacion>}
 */
export async function reputacionDe(usuarioId, opciones = {}) {
  return (await reputacionesDe([usuarioId], opciones)).get(String(usuarioId));
}
