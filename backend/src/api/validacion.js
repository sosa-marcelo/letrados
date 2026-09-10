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

  if (contrasena.length < LARGO_MIN_CONTRASENA) {
    detalles.push({
      campo: 'contrasena',
      mensaje: `La contrasena debe tener al menos ${LARGO_MIN_CONTRASENA} caracteres`,
    });
  }

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
  if (contrasena.length < LARGO_MIN_CONTRASENA) {
    detalles.push({
      campo: 'contrasena',
      mensaje: `La contrasena debe tener al menos ${LARGO_MIN_CONTRASENA} caracteres`,
    });
  }

  lanzarSiHay(detalles);
  return { token, contrasena };
}
