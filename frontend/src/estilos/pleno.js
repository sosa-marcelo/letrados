/*
 * Sistema visual "Pleno": cada paso del flujo tiene un color pleno, así se
 * sabe en qué pantalla se está sin leer un título.
 *
 *   entrar · enlace enviado · home   -> verde
 *   crear cuenta · contraseña nueva  -> naranja
 *   recuperar                        -> tinta
 *
 * Los componentes base reciben el color como parámetro (nunca lo fijan
 * adentro). El complementario se usa para el foco de teclado y para la
 * palabra resaltada del lema: verde sobre naranja, naranja sobre verde.
 */

export const VERDE = 'var(--verde)'
export const NARANJA = 'var(--naranja)'
export const TINTA = 'var(--tinta)'

/** Color pleno de cada paso, por si una pantalla lo quiere por nombre. */
export const plenoPorPaso = {
  entrar: VERDE,
  enlaceEnviado: VERDE,
  home: VERDE,
  crearCuenta: NARANJA,
  contrasenaNueva: NARANJA,
  recuperar: TINTA,
}

/**
 * Devuelve el complementario de un color pleno.
 * verde <-> naranja; para tinta (y cualquier otro) cae en naranja.
 */
export function complementarioDe(pleno) {
  if (pleno === VERDE || pleno === '#0e4d3c' || pleno === '#0E4D3C') return NARANJA
  if (pleno === NARANJA || pleno === '#f4632a' || pleno === '#F4632A') return VERDE
  return NARANJA
}

/**
 * Color de texto legible sobre un fondo pleno: crema sobre verde,
 * tinta sobre naranja. Para cualquier otro fondo cae en crema.
 */
export function textoSobre(fondo) {
  if (fondo === NARANJA || fondo === '#f4632a' || fondo === '#F4632A') return 'var(--tinta)'
  return 'var(--crema)'
}
