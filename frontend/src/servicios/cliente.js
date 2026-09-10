import { leerToken } from './token.js'

/*
 * Cliente HTTP: un envoltorio de fetch para hablar con la API.
 *
 * - Siempre usa rutas relativas bajo /api. En desarrollo el proxy de Vite
 *   las manda al backend (localhost:3000); en producción Express sirve la API
 *   y los estáticos en el mismo origen.
 * - Si hay token en localStorage, agrega Authorization: Bearer <token>.
 * - Manda y recibe JSON.
 * - Traduce cualquier error (de red o de la API) a un ErrorApi con forma
 *   estable para que el llamador no tenga que mirar el status a mano.
 *
 * La API contesta los errores siempre así:
 *   { "error": { "codigo": "EMAIL_DUPLICADO", "mensaje": "...", "detalles": [] } }
 *
 * Aviso: mientras el backend no esté, las rutas /api/* responden 501; eso
 * llega como ErrorApi con codigo 'HTTP_501'.
 *
 * El cliente no confía en que un 200 signifique éxito: si la respuesta es OK
 * pero el cuerpo no es JSON (y no es un 204/205 ni un cuerpo vacío), eso no es
 * "éxito sin contenido", es una respuesta que no entendemos —pasa, por
 * ejemplo, cuando el comodín de la SPA se traga una ruta de API mal escrita y
 * devuelve el index.html con 200—. En ese caso se lanza ErrorApi con codigo
 * 'RESPUESTA_NO_JSON'.
 */

const BASE = '/api'

export class ErrorApi extends Error {
  constructor({ codigo, mensaje, detalles, estado }) {
    super(mensaje || 'Ocurrió un error inesperado.')
    this.name = 'ErrorApi'
    this.codigo = codigo || 'DESCONOCIDO'
    this.mensaje = this.message
    this.detalles = Array.isArray(detalles) ? detalles : []
    this.estado = typeof estado === 'number' ? estado : 0
  }
}

function armarUrl(ruta) {
  if (ruta.startsWith('http://') || ruta.startsWith('https://')) return ruta
  if (ruta.startsWith(BASE)) return ruta
  return BASE + (ruta.startsWith('/') ? ruta : `/${ruta}`)
}

function mensajePorEstado(estado) {
  if (estado === 401) return 'Necesitás iniciar sesión.'
  if (estado === 403) return 'No tenés permiso para esto.'
  if (estado === 404) return 'No se encontró lo que buscabas.'
  if (estado === 409) return 'Hay un conflicto con el estado actual.'
  if (estado === 422) return 'Revisá los datos que enviaste.'
  if (estado === 429) return 'Demasiados intentos. Probá de nuevo en un rato.'
  if (estado === 501) return 'El servidor todavía no implementa esto.'
  if (estado >= 500) return 'El servidor tuvo un problema. Probá de nuevo.'
  return 'No se pudo completar la solicitud.'
}

// Devuelve { esJson, datos }. esJson es false cuando el cuerpo no era JSON
// interpretable; datos sólo tiene sentido si esJson es true.
async function leerCuerpo(respuesta) {
  const tipo = respuesta.headers.get('content-type') || ''
  if (!tipo.includes('application/json')) return { esJson: false, datos: null }
  try {
    return { esJson: true, datos: await respuesta.json() }
  } catch {
    return { esJson: false, datos: null }
  }
}

// Una respuesta OK sin cuerpo es un éxito legítimo (204/205, o Content-Length 0).
function sinCuerpo(respuesta) {
  return (
    respuesta.status === 204 ||
    respuesta.status === 205 ||
    respuesta.headers.get('content-length') === '0'
  )
}

/**
 * @param {string} ruta  Ruta relativa; se le antepone /api si hace falta.
 * @param {{ metodo?: string, cuerpo?: unknown, cabeceras?: Record<string,string>, senal?: AbortSignal }} [opciones]
 * @returns {Promise<any>} El cuerpo JSON de la respuesta (o null si fue un
 *   éxito sin cuerpo: 204/205 o Content-Length 0).
 * @throws {ErrorApi} Ante error de red, respuesta no OK, o respuesta OK cuyo
 *   cuerpo no es JSON (codigo 'RESPUESTA_NO_JSON').
 */
export async function solicitar(ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo, cabeceras, senal } = opciones

  const init = {
    method: metodo,
    headers: { Accept: 'application/json', ...cabeceras },
    signal: senal,
  }

  const token = leerToken()
  if (token) init.headers.Authorization = `Bearer ${token}`

  if (cuerpo !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(cuerpo)
  }

  let respuesta
  try {
    respuesta = await fetch(armarUrl(ruta), init)
  } catch {
    throw new ErrorApi({
      codigo: 'SIN_RED',
      mensaje: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      estado: 0,
    })
  }

  const { esJson, datos } = await leerCuerpo(respuesta)

  if (!respuesta.ok) {
    const error = esJson && datos && typeof datos.error === 'object' ? datos.error : {}
    throw new ErrorApi({
      codigo: error.codigo || `HTTP_${respuesta.status}`,
      mensaje: error.mensaje || mensajePorEstado(respuesta.status),
      detalles: error.detalles,
      estado: respuesta.status,
    })
  }

  if (!esJson) {
    if (sinCuerpo(respuesta)) return null
    throw new ErrorApi({
      codigo: 'RESPUESTA_NO_JSON',
      mensaje: 'El servidor devolvió una respuesta inesperada.',
      estado: respuesta.status,
    })
  }

  return datos
}

/** GET /api/<ruta> */
export function obtener(ruta, opciones) {
  return solicitar(ruta, { ...opciones, metodo: 'GET' })
}

/** POST /api/<ruta> con cuerpo JSON */
export function enviar(ruta, cuerpo, opciones) {
  return solicitar(ruta, { ...opciones, metodo: 'POST', cuerpo })
}

/** PUT /api/<ruta> con cuerpo JSON */
export function actualizar(ruta, cuerpo, opciones) {
  return solicitar(ruta, { ...opciones, metodo: 'PUT', cuerpo })
}

/** DELETE /api/<ruta> */
export function eliminar(ruta, opciones) {
  return solicitar(ruta, { ...opciones, metodo: 'DELETE' })
}
