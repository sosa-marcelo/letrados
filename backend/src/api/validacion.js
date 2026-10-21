import { datosInvalidos } from '../domain/errores.js';

/**
 * Validacion de la entrada de la API. Sin libreria: son cuatro formularios y las
 * reglas son simples. Cada `validar*` recibe el cuerpo crudo, junta todos los
 * errores en `detalles` y, si hay alguno, lanza `datosInvalidos(detalles)` (400).
 *
 * Lo que NO hace: normalizar el correo a minusculas. Eso es una regla de negocio
 * y vive en `domain`. Aca solo se recorta el espacio de los bordes para validar.
 */

// Suficiente para descartar lo obviamente mal escrito. La verdad sobre si un
// correo existe la tiene el envio, no una expresion regular.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LARGO_MIN_CONTRASENA = 8;
const LARGO_MAX_NOMBRE = 80;
const LARGO_MAX_EMAIL = 254;

const TIENE_LETRA = /[a-zA-Z]/;
const TIENE_NUMERO = /[0-9]/;
const BYTES_MAX_CONTRASENA = 72;

/** @param {unknown} valor */
function esTextoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 */
function lanzarSiHay(detalles) {
  if (detalles.length > 0) {
    throw datosInvalidos(detalles);
  }
}

/** Reglas de una contrasena nueva. Agrega lo que encuentre a `detalles`. */
function revisarContrasenaNueva(contrasena, detalles) {
  if (contrasena.length < LARGO_MIN_CONTRASENA) {
    detalles.push({
      campo: 'contrasena',
      mensaje: `La contrasena debe tener al menos ${LARGO_MIN_CONTRASENA} caracteres`,
    });
    return; // si es corta, con esa queja alcanza
  }

  if (!TIENE_LETRA.test(contrasena) || !TIENE_NUMERO.test(contrasena)) {
    detalles.push({
      campo: 'contrasena',
      mensaje: 'La contrasena debe tener al menos una letra y un numero',
    });
  }

  if (Buffer.byteLength(contrasena, 'utf8') > BYTES_MAX_CONTRASENA) {
    detalles.push({
      campo: 'contrasena',
      mensaje: `La contrasena no puede superar los ${BYTES_MAX_CONTRASENA} bytes`,
    });
  }
}

/**
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ nombre: string, email: string, contrasena: string }}
 */
export function validarRegistro(cuerpo = {}) {
  const detalles = [];
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';
  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : '';
  const contrasena =
    typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';

  if (nombre === '') {
    detalles.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio' });
  } else if (nombre.length > LARGO_MAX_NOMBRE) {
    detalles.push({
      campo: 'nombre',
      mensaje: `El nombre no puede superar los ${LARGO_MAX_NOMBRE} caracteres`,
    });
  }

  if (!esTextoNoVacio(email) || !FORMATO_EMAIL.test(email)) {
    detalles.push({ campo: 'email', mensaje: 'El correo no tiene un formato valido' });
  } else if (email.length > LARGO_MAX_EMAIL) {
    detalles.push({
      campo: 'email',
      mensaje: `El correo no puede superar los ${LARGO_MAX_EMAIL} caracteres`,
    });
  }

  revisarContrasenaNueva(contrasena, detalles);

  lanzarSiHay(detalles);
  return { nombre, email, contrasena };
}

/**
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ email: string, contrasena: string }}
 */
export function validarLogin(cuerpo = {}) {
  const detalles = [];
  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : '';
  const contrasena =
    typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';

  if (!esTextoNoVacio(email)) {
    detalles.push({ campo: 'email', mensaje: 'El correo es obligatorio' });
  }
  if (contrasena === '') {
    detalles.push({ campo: 'contrasena', mensaje: 'La contrasena es obligatoria' });
  }

  lanzarSiHay(detalles);
  return { email, contrasena };
}

/**
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ email: string }}
 */
export function validarPedidoRecuperacion(cuerpo = {}) {
  const detalles = [];
  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : '';

  if (!esTextoNoVacio(email) || !FORMATO_EMAIL.test(email)) {
    detalles.push({ campo: 'email', mensaje: 'El correo no tiene un formato valido' });
  }

  lanzarSiHay(detalles);
  return { email };
}

/**
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ token: string, contrasena: string }}
 */
export function validarConfirmacionRecuperacion(cuerpo = {}) {
  const detalles = [];
  const token = typeof cuerpo.token === 'string' ? cuerpo.token.trim() : '';
  const contrasena =
    typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';

  if (token === '') {
    detalles.push({ campo: 'token', mensaje: 'El token es obligatorio' });
  }
  revisarContrasenaNueva(contrasena, detalles);

  lanzarSiHay(detalles);
  return { token, contrasena };
}

const LARGO_MAX_TITULO = 200;
const LARGO_MAX_AUTOR = 200;

/**
 * Alta y modificacion de un libro (RF-10, RF-11). Los tres campos completos
 * siempre: la modificacion es reemplazo, no parche.
 *
 * - `titulo` y `autor`: obligatorios, hasta 200 caracteres, recortados.
 * - `cantidad`: entero >= 1. Se acepta `2` o `"2"` (lo que manda un input),
 *   no `2.5`, `"dos"` ni `0`.
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ titulo: string, autor: string, cantidad: number }}
 */
export function validarLibro(cuerpo = {}) {
  const detalles = [];
  const titulo = typeof cuerpo.titulo === 'string' ? cuerpo.titulo.trim() : '';
  const autor = typeof cuerpo.autor === 'string' ? cuerpo.autor.trim() : '';

  if (titulo === '') {
    detalles.push({ campo: 'titulo', mensaje: 'El titulo es obligatorio' });
  } else if (titulo.length > LARGO_MAX_TITULO) {
    detalles.push({
      campo: 'titulo',
      mensaje: `El titulo no puede superar los ${LARGO_MAX_TITULO} caracteres`,
    });
  }

  if (autor === '') {
    detalles.push({ campo: 'autor', mensaje: 'El autor es obligatorio' });
  } else if (autor.length > LARGO_MAX_AUTOR) {
    detalles.push({
      campo: 'autor',
      mensaje: `El autor no puede superar los ${LARGO_MAX_AUTOR} caracteres`,
    });
  }

  const crudo = cuerpo.cantidad;
  const esEnteroTexto = typeof crudo === 'string' && /^\s*\d+\s*$/.test(crudo);
  const cantidad =
    typeof crudo === 'number' ? crudo : esEnteroTexto ? Number.parseInt(crudo, 10) : NaN;

  if (!Number.isInteger(cantidad) || cantidad < 1) {
    detalles.push({
      campo: 'cantidad',
      mensaje: 'La cantidad debe ser un numero entero mayor o igual a 1',
    });
  }

  lanzarSiHay(detalles);
  return { titulo, autor, cantidad };
}

/**
 * Baja de cuenta (RF-09): pide la contrasena para volver a autenticarse.
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ contrasena: string }}
 */
export function validarBaja(cuerpo = {}) {
  const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '';
  if (contrasena === '') {
    throw datosInvalidos([{ campo: 'contrasena', mensaje: 'La contrasena es obligatoria' }]);
  }
  return { contrasena };
}

/**
 * Si un parametro de ruta puede ser un id (BIGSERIAL): entero positivo. Lo que
 * no lo es se responde 404 sin consultar la base, porque el cast a BIGINT de
 * un texto cualquiera fallaria como 500.
 *
 * @param {string} crudo
 * @returns {boolean}
 */
export function esIdValido(crudo) {
  return typeof crudo === 'string' && /^[1-9]\d{0,17}$/.test(crudo);
}
