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

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 400 TOKEN_INVALIDO
 */
export function tokenInvalido(
  mensaje = 'El enlace no es valido o ya vencio',
) {
  return new ErrorDominio('TOKEN_INVALIDO', 400, mensaje);
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 401 CREDENCIALES_INVALIDAS
 */
export function credencialesInvalidas(
  mensaje = 'El correo o la contrasena no son correctos',
) {
  return new ErrorDominio('CREDENCIALES_INVALIDAS', 401, mensaje);
}

/**
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 401 SESION_INVALIDA
 */
export function sesionInvalida(
  mensaje = 'La sesion no es valida o expiro. Inicia sesion de nuevo.',
) {
  return new ErrorDominio('SESION_INVALIDA', 401, mensaje);
}

/**
 * Cuenta bloqueada o dada de baja. Solo se responde a quien ya probo saber la
 * contrasena (DISENIO-GENERAL §7.4), asi que no revela nada nuevo.
 *
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 403 CUENTA_BLOQUEADA
 */
export function cuentaBloqueada(
  mensaje = 'Tu cuenta no esta habilitada. Si crees que es un error, contacta a un administrador.',
) {
  return new ErrorDominio('CUENTA_BLOQUEADA', 403, mensaje);
}

/**
 * La sesion es valida pero no tiene permiso (rol).
 *
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 403 ACCESO_DENEGADO
 */
export function accesoDenegado(
  mensaje = 'No tenes permiso para realizar esta accion',
) {
  return new ErrorDominio('ACCESO_DENEGADO', 403, mensaje);
}

/**
 * El recurso no existe, o existe y no corresponde mostrarlo (un recurso
 * privado ajeno): devolver 403 ahi confirmaria que el id existe.
 *
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 404 NO_ENCONTRADO
 */
export function noEncontrado(mensaje = 'No encontramos lo que buscabas') {
  return new ErrorDominio('NO_ENCONTRADO', 404, mensaje);
}

/**
 * La operacion no es legal para el estado actual del recurso.
 *
 * @param {string} mensaje
 * @param {Array<{ campo?: string, mensaje: string }>} [detalles]
 * @returns {ErrorDominio} 409 ESTADO_INVALIDO
 */
export function estadoInvalido(mensaje, detalles = []) {
  return new ErrorDominio('ESTADO_INVALIDO', 409, mensaje, detalles);
}

/**
 * Reautenticacion fallida (cambio de contrasena, baja). La sesion ya
 * identifica a la persona: decirle que campo fallo no protege nada.
 *
 * @param {string} [mensaje]
 * @returns {ErrorDominio} 401 CONTRASENA_INCORRECTA
 */
export function contrasenaIncorrecta(mensaje = 'La contrasena no es correcta') {
  return new ErrorDominio('CONTRASENA_INCORRECTA', 401, mensaje);
}
