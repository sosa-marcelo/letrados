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

/**
 * Modificacion del nombre (RF-05). Mismas reglas que el registro:
 * obligatorio, recortado, hasta 80 caracteres. Otros campos se ignoran.
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ nombre: string }}
 */
export function validarNombrePerfil(cuerpo = {}) {
  const detalles = [];
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : '';

  if (nombre === '') {
    detalles.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio' });
  } else if (nombre.length > LARGO_MAX_NOMBRE) {
    detalles.push({
      campo: 'nombre',
      mensaje: `El nombre no puede superar los ${LARGO_MAX_NOMBRE} caracteres`,
    });
  }

  lanzarSiHay(detalles);
  return { nombre };
}

const LARGO_MAX_TITULO = 200;
const LARGO_MAX_AUTOR = 200;
const LARGO_MAX_EDITORIAL = 120;
const LARGO_MAX_EDICION = 60;
const LARGO_MAX_DESCRIPCION = 500;
const ANIO_MINIMO = 1450;

/** Valores admitidos para `estadoConservacion` (CHECK de la migracion 005). */
export const ESTADOS_CONSERVACION = ['nuevo', 'muy_bueno', 'bueno', 'gastado'];

// ISBN-10 (nueve digitos y un ultimo digito o X) o ISBN-13, ya sin separadores.
const FORMATO_ISBN = /^(\d{9}[\dX]|\d{13})$/;

/**
 * Texto opcional: ausente, `null` o vacio despues de recortar -> `null`.
 * Otro tipo que no sea texto, o un largo mayor al tope, agrega un detalle.
 *
 * @param {unknown} crudo
 * @param {{ campo: string, etiqueta: string, maximo: number }} regla
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 * @returns {string | null}
 */
function textoOpcional(crudo, { campo, etiqueta, maximo }, detalles) {
  if (crudo === undefined || crudo === null) return null;
  if (typeof crudo !== 'string') {
    detalles.push({ campo, mensaje: `${etiqueta} debe ser texto` });
    return null;
  }
  const texto = crudo.trim();
  if (texto === '') return null;
  if (texto.length > maximo) {
    detalles.push({ campo, mensaje: `${etiqueta} no puede superar los ${maximo} caracteres` });
  }
  return texto;
}

/**
 * Año de publicacion opcional: entero entre 1450 y el año actual. Acepta
 * `1963` o `"1963"` (lo que manda un input); vacio -> `null`.
 *
 * @param {unknown} crudo
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 * @returns {number | null}
 */
function anioOpcional(crudo, detalles) {
  if (crudo === undefined || crudo === null) return null;
  if (typeof crudo === 'string' && crudo.trim() === '') return null;

  const esEnteroTexto = typeof crudo === 'string' && /^\s*\d+\s*$/.test(crudo);
  const anio =
    typeof crudo === 'number' ? crudo : esEnteroTexto ? Number.parseInt(crudo, 10) : NaN;
  const actual = new Date().getFullYear();

  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > actual) {
    detalles.push({
      campo: 'anio',
      mensaje: `El año debe ser un número entero entre ${ANIO_MINIMO} y ${actual}`,
    });
    return null;
  }
  return anio;
}

/**
 * ISBN opcional. Se quitan guiones y espacios, y la `x` final pasa a `X`.
 * Solo se valida el formato: no se consulta ningun catalogo externo.
 *
 * @param {unknown} crudo
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 * @returns {string | null}
 */
function isbnOpcional(crudo, detalles) {
  if (crudo === undefined || crudo === null) return null;
  const mensaje = 'El ISBN debe tener 10 caracteres (el último puede ser X) o 13 dígitos';
  if (typeof crudo !== 'string') {
    detalles.push({ campo: 'isbn', mensaje });
    return null;
  }
  const isbn = crudo.replace(/[\s-]/g, '').toUpperCase();
  if (isbn === '') return null;
  if (!FORMATO_ISBN.test(isbn)) {
    detalles.push({ campo: 'isbn', mensaje });
    return null;
  }
  return isbn;
}

/**
 * Estado de conservacion opcional: uno de `ESTADOS_CONSERVACION`; vacio -> `null`.
 *
 * @param {unknown} crudo
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 * @returns {string | null}
 */
function estadoConservacionOpcional(crudo, detalles) {
  if (crudo === undefined || crudo === null || crudo === '') return null;
  if (typeof crudo !== 'string' || !ESTADOS_CONSERVACION.includes(crudo)) {
    detalles.push({
      campo: 'estadoConservacion',
      mensaje: 'El estado de conservación debe ser nuevo, muy_bueno, bueno o gastado',
    });
    return null;
  }
  return crudo;
}

/**
 * @typedef {object} DatosLibro
 * @property {string} titulo
 * @property {string} autor
 * @property {number} cantidad
 * @property {string | null} editorial
 * @property {number | null} anio
 * @property {string | null} edicion
 * @property {string | null} isbn - sin guiones ni espacios.
 * @property {string | null} estadoConservacion
 * @property {string | null} descripcion
 */

/**
 * Alta y modificacion de un libro (RF-10, RF-11 v1.1). La modificacion es
 * reemplazo, no parche: un dato opcional que no viene queda en `null`.
 *
 * - `titulo` y `autor`: obligatorios, hasta 200 caracteres, recortados.
 * - `cantidad`: entero >= 1. Se acepta `2` o `"2"` (lo que manda un input),
 *   no `2.5`, `"dos"` ni `0`.
 * - Opcionales (LET-119): `editorial` (hasta 120), `anio` (entero entre 1450 y
 *   el año actual), `edicion` (hasta 60), `isbn` (10 o 13, sin separadores),
 *   `estadoConservacion` (`ESTADOS_CONSERVACION`) y `descripcion` (hasta 500).
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {DatosLibro}
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

  const editorial = textoOpcional(
    cuerpo.editorial,
    { campo: 'editorial', etiqueta: 'La editorial', maximo: LARGO_MAX_EDITORIAL },
    detalles,
  );
  const anio = anioOpcional(cuerpo.anio, detalles);
  const edicion = textoOpcional(
    cuerpo.edicion,
    { campo: 'edicion', etiqueta: 'La edición', maximo: LARGO_MAX_EDICION },
    detalles,
  );
  const isbn = isbnOpcional(cuerpo.isbn, detalles);
  const estadoConservacion = estadoConservacionOpcional(cuerpo.estadoConservacion, detalles);
  const descripcion = textoOpcional(
    cuerpo.descripcion,
    { campo: 'descripcion', etiqueta: 'La descripción', maximo: LARGO_MAX_DESCRIPCION },
    detalles,
  );

  lanzarSiHay(detalles);
  return {
    titulo,
    autor,
    cantidad,
    editorial,
    anio,
    edicion,
    isbn,
    estadoConservacion,
    descripcion,
  };
}

const LARGO_MAX_NOTA = 300;

/**
 * Nota opcional de una publicacion: recortada, hasta 300; vacia -> `null`.
 *
 * @param {unknown} crudo
 * @param {Array<{ campo: string, mensaje: string }>} detalles
 * @returns {string | null}
 */
function notaOpcional(crudo, detalles) {
  return textoOpcional(
    crudo,
    { campo: 'nota', etiqueta: 'La nota', maximo: LARGO_MAX_NOTA },
    detalles,
  );
}

/**
 * Alta de una publicacion (RF-14, LET-129): el libro propio que se publica y
 * una nota opcional. El id viaja como texto o numero (lo que mande el cliente).
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ libroId: string, nota: string | null }}
 */
export function validarPublicacion(cuerpo = {}) {
  const detalles = [];
  const crudo = cuerpo.libroId;
  const libroId = typeof crudo === 'number' || typeof crudo === 'string' ? String(crudo).trim() : '';
  if (!esIdValido(libroId)) {
    detalles.push({ campo: 'libroId', mensaje: 'Elegí un libro de tu catálogo' });
  }
  const nota = notaOpcional(cuerpo.nota, detalles);
  lanzarSiHay(detalles);
  return { libroId, nota };
}

/**
 * Cambio de la nota de una publicacion (RF-14, LET-129). Reemplazo: si no
 * viene, queda en `null`.
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ nota: string | null }}
 */
export function validarNota(cuerpo = {}) {
  const detalles = [];
  const nota = notaOpcional(cuerpo.nota, detalles);
  lanzarSiHay(detalles);
  return { nota };
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

/**
 * Cambio de contrasena desde el perfil (RF-05). La actual solo tiene que
 * venir; la nueva sigue las reglas del registro.
 *
 * @param {Record<string, unknown>} cuerpo
 * @returns {{ contrasenaActual: string, contrasenaNueva: string }}
 */
export function validarCambioContrasena(cuerpo = {}) {
  const detalles = [];
  const contrasenaActual = typeof cuerpo.contrasenaActual === 'string' ? cuerpo.contrasenaActual : '';
  const contrasenaNueva = typeof cuerpo.contrasenaNueva === 'string' ? cuerpo.contrasenaNueva : '';

  if (contrasenaActual === '') {
    detalles.push({ campo: 'contrasenaActual', mensaje: 'La contrasena actual es obligatoria' });
  }

  const deLaNueva = [];
  revisarContrasenaNueva(contrasenaNueva, deLaNueva);
  // Las reglas anotan 'contrasena'; aca el campo se llama contrasenaNueva.
  for (const d of deLaNueva) detalles.push({ ...d, campo: 'contrasenaNueva' });

  lanzarSiHay(detalles);
  return { contrasenaActual, contrasenaNueva };
}
