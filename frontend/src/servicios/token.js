/*
 * Guarda el token de sesión en localStorage. Es la única fuente del token:
 * el cliente HTTP lo lee de acá y el contexto de sesión (otra épica) va a
 * construir encima. Todo con try/catch porque localStorage puede tirar en
 * navegación privada o con el almacenamiento bloqueado.
 */
const CLAVE = 'letrados.token'

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE, token)
  } catch {
    /* sin persistencia disponible: la sesión dura lo que la pestaña */
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada que hacer */
  }
}
