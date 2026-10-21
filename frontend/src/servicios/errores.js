import { ErrorApi } from './cliente.js'

/*
 * Ayudas para traducir errores de la API a lo que muestra un formulario.
 */

/** { campo, mensaje }[] -> { [campo]: mensaje } (los 400 DATOS_INVALIDOS). */
export function mapearDetalles(detalles = []) {
  const mapa = {}
  for (const d of detalles) {
    if (d && d.campo) mapa[d.campo] = d.mensaje
  }
  return mapa
}

/** true si el error es de red: el servidor no contestó. */
export function esSinRed(error) {
  return !(error instanceof ErrorApi) || error.codigo === 'SIN_RED'
}

/**
 * Mensaje para un aviso general. Sin red, el texto propio de la pantalla
 * (`sinRed`); con respuesta del servidor, el mensaje que mandó la API.
 */
export function mensajeDeError(
  error,
  sinRed = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
) {
  if (esSinRed(error)) return sinRed
  return error.mensaje
}
