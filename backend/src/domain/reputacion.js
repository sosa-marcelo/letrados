/**
 * Reputacion de los usuarios (RF-26). Vive en su propio modulo porque la usan
 * el perfil y las publicaciones: si estuviera en `perfil.js`, perfil y
 * publicaciones se importarian en circulo (LET-128).
 *
 * Las valoraciones llegan con el modulo 5 (epica LET-116, LET-164): hasta
 * entonces nadie tiene valoraciones y la interfaz muestra «Sin valoraciones».
 * Las firmas ya son las definitivas, asi que quien las usa no cambia.
 */

/**
 * @typedef {{ promedio: number | null, cantidad: number }} Reputacion
 */

/** Reputacion de quien no recibio valoraciones. */
export const SIN_VALORACIONES = Object.freeze({ promedio: null, cantidad: 0 });

/**
 * Reputacion de un usuario.
 *
 * @param {string} _usuarioId
 * @param {{ ejecutar?: Function }} [_opciones]
 * @returns {Promise<Reputacion>}
 */
export async function reputacionDe(_usuarioId, _opciones = {}) {
  return { ...SIN_VALORACIONES };
}

/**
 * Reputacion de varios usuarios a la vez, para un listado entero con una sola
 * consulta. Todo id pedido aparece en el mapa.
 *
 * @param {string[]} usuarioIds
 * @param {{ ejecutar?: Function }} [_opciones]
 * @returns {Promise<Map<string, Reputacion>>}
 */
export async function reputacionesDe(usuarioIds, _opciones = {}) {
  return new Map(usuarioIds.map((id) => [String(id), { ...SIN_VALORACIONES }]));
}
