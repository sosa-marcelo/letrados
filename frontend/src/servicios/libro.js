/*
 * Textos y formatos de los datos de un libro (LET-112), compartidos por el
 * catálogo, Explorar, el detalle de una publicación y el perfil público.
 */

/** Estados de conservación, con el texto que ve la persona. */
export const ESTADOS_CONSERVACION = [
  ['nuevo', 'Nuevo'],
  ['muy_bueno', 'Muy bueno'],
  ['bueno', 'Bueno'],
  ['gastado', 'Gastado'],
]

/** Texto de un estado de conservación, o null si no hay. */
export function textoEstadoConservacion(valor) {
  const estado = ESTADOS_CONSERVACION.find(([clave]) => clave === valor)
  return estado ? estado[1] : null
}

/**
 * «Editorial · Año · Estado: …» solo con los datos que existan. Sin ninguno
 * devuelve '' y quien lo usa no dibuja la línea.
 */
export function lineaDeDatos(libro) {
  const estado = textoEstadoConservacion(libro.estadoConservacion)
  return [libro.editorial, libro.anio, estado && `Estado: ${estado.toLowerCase()}`]
    .filter(Boolean)
    .join(' · ')
}

/**
 * URL de la foto de una publicación. `version` evita que el navegador muestre
 * la foto anterior (la API la cachea 5 minutos) después de cambiarla.
 */
export function urlFoto(publicacionId, version) {
  const base = `/api/publicaciones/${publicacionId}/foto`
  return version ? `${base}?v=${version}` : base
}
