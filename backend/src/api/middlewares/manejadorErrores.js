import { ErrorDominio, jsonInvalido } from '../../domain/errores.js';
import { registrador } from '../../infra/registrador.js';

/**
 * Manejador central de errores. Ultimo middleware de la cadena de `/api`.
 * Convierte cualquier error en una respuesta con el formato unico:
 *
 *   { "error": { "codigo": "...", "mensaje": "...", "detalles": [] } }
 *
 * - `ErrorDominio`: usa su `codigo`, `estado`, `mensaje` y `detalles`.
 * - Error del parseo de JSON (`entity.parse.failed`): 400 `JSON_INVALIDO`. Es
 *   culpa del cliente, no nuestra, asi que no puede salir como 500. El mensaje
 *   no repite lo que mando el cliente.
 * - Cualquier otro error: 500 `ERROR_INTERNO` con un mensaje generico. Nunca se
 *   filtra al cliente el `stack` ni el detalle interno.
 * - Nunca se registra el cuerpo de la peticion (puede traer contrasenas o
 *   tokens, RNF-01). Se registra solo metodo, ruta, codigo y estado; para los
 *   500, ademas el stack, del lado del servidor.
 *
 * @type {import('express').ErrorRequestHandler}
 */
export function manejadorErrores(error, req, res, _next) {
  // El body-parser avisa asi cuando el cuerpo no se pudo leer como JSON.
  if (error?.type === 'entity.parse.failed') {
    error = jsonInvalido();
  }

  const esDominio = error instanceof ErrorDominio;

  const estado = esDominio ? error.estado : 500;
  const codigo = esDominio ? error.codigo : 'ERROR_INTERNO';
  const mensaje = esDominio
    ? error.message
    : 'Ocurrio un error inesperado. Volve a intentar en un momento.';
  const detalles = esDominio && Array.isArray(error.detalles) ? error.detalles : [];

  const contexto = { metodo: req.method, ruta: req.originalUrl, codigo, estado };
  if (estado >= 500) {
    registrador.error('Error no controlado en la API', contexto, error);
  } else {
    registrador.advertencia('Error controlado en la API', contexto);
  }

  if (res.headersSent) {
    return _next(error);
  }

  res.status(estado).json({ error: { codigo, mensaje, detalles } });
}

export default manejadorErrores;
