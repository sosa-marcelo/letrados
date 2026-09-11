/**
 * Error de dominio. Lo lanza la capa `domain` cuando una regla de negocio no se
 * cumple. Lleva su propio `codigo` y `estado` HTTP para que `api` lo traduzca a
 * respuesta sin que `domain` tenga que conocer Express.
 *
 * `domain` NO deberia importar nada de HTTP; esta clase es la excepcion acordada:
 * un numero de estado es un dato, no una dependencia de framework.
 */
export class ErrorDominio extends Error {
  /**
   * @param {string} codigo - identificador estable, en MAYUSCULAS (p. ej. `EMAIL_DUPLICADO`).
   * @param {number} estado - codigo de estado HTTP.
   * @param {string} mensaje - texto para el usuario final. Sin datos internos.
   * @param {Array<{ campo?: string, mensaje: string }>} [detalles] - errores puntuales.
   */
  constructor(codigo, estado, mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    this.estado = estado;
    this.detalles = detalles;
  }
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 501 NO_IMPLEMENTADO
 */
export function noImplementado(
  mensaje = 'Esta funcionalidad todavia no esta implementada',
) {
  return new ErrorDominio('NO_IMPLEMENTADO', 501, mensaje);
}

/**
 * @param {Array<{ campo?: string, mensaje: string }>} [detalles]
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 400 DATOS_INVALIDOS
 */
export function datosInvalidos(
  detalles = [],
  mensaje = 'Los datos enviados no son validos',
) {
  return new ErrorDominio('DATOS_INVALIDOS', 400, mensaje, detalles);
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 404 RUTA_NO_ENCONTRADA
 */
export function rutaNoEncontrada(mensaje = 'La ruta solicitada no existe') {
  return new ErrorDominio('RUTA_NO_ENCONTRADA', 404, mensaje);
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 400 JSON_INVALIDO
 */
export function jsonInvalido(
  mensaje = 'El cuerpo de la peticion no es JSON valido',
) {
  return new ErrorDominio('JSON_INVALIDO', 400, mensaje);
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 409 EMAIL_DUPLICADO
 */
export function emailDuplicado(
  mensaje = 'Ya existe una cuenta con ese correo',
) {
  return new ErrorDominio('EMAIL_DUPLICADO', 409, mensaje);
}
