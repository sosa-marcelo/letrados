import { createHash, randomBytes } from 'node:crypto';

import { noImplementado, emailDuplicado, tokenInvalido } from './errores.js';
import { hashear } from '../infra/hash.js';
import { firmar } from '../infra/jwt.js';
import { enviarCorreo } from '../infra/correo.js';
import { obtenerConfig } from '../infra/config.js';
import { registrador } from '../infra/registrador.js';
import {
  insertarUsuario,
  buscarUsuarioPorEmail,
  actualizarContrasena,
} from '../data/usuarios.js';
import {
  insertarToken,
  buscarTokenVigentePorHash,
  marcarTokenUsado,
  invalidarTokensPendientesDeUsuario,
} from '../data/tokens.js';

/**
 * Reglas de negocio de autenticacion.
 *
 * LET-18 congelo el contrato: cada funcion existe con su firma definitiva.
 * LET-13 queda pendiente y sigue lanzando `NO_IMPLEMENTADO` (501).
 *
 * Ninguna funcion conoce HTTP: reciben datos planos y devuelven datos planos o
 * lanzan `ErrorDominio`.
 */

/** Codigo que PostgreSQL (y `pg-mem`) usan para una violacion de unicidad. */
const VIOLACION_UNICIDAD = '23505';

/**
 * Registra un usuario nuevo: hashea la contrasena, normaliza el correo a
 * minusculas y lo inserta. Devuelve una sesion recien firmada.
 *
 * No consulta si el correo existe antes de insertar: intenta el insert
 * directo y traduce el rechazo. Con una consulta previa, dos registros
 * simultaneos con el mismo correo pasarian los dos (ventana de carrera); el
 * `UNIQUE` de la base (mas el indice sobre `lower(email)` de la migracion 002)
 * es lo unico que lo evita de verdad.
 *
 * El duplicado se detecta por `error.code === '23505'` (codigo estandar de
 * PostgreSQL para violacion de restriccion unica), nunca por el nombre de la
 * restriccion: hay dos restricciones distintas que lo pueden disparar y no
 * vale la pena acoplarse a cual fue.
 *
 * @param {{ nombre: string, email: string, contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones] -
 *   `ejecutar` es el ejecutor de consultas inyectable para pruebas; sin el,
 *   `insertarUsuario` usa el pool real.
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
export async function registrar({ nombre, email, contrasena }, { ejecutar } = {}) {
  const contrasena_hash = await hashear(contrasena);

  let fila;
  try {
    fila = await insertarUsuario(
      { nombre, email: email.trim().toLowerCase(), contrasena_hash },
      ejecutar,
    );
  } catch (error) {
    if (error?.code === VIOLACION_UNICIDAD) {
      throw emailDuplicado();
    }
    throw error;
  }

  const usuario = { id: String(fila.id), nombre: fila.nombre, email: fila.email };
  return { token: firmar(usuario.id), usuario };
}

/**
 * Valida credenciales y devuelve una sesion. Ante cualquier fallo lanza
 * `CREDENCIALES_INVALIDAS` sin distinguir si fallo el correo o la contrasena.
 * Epica LET-13.
 *
 * @param {{ email: string, contrasena: string }} _datos
 * @returns {Promise<{ token: string, usuario: { id: string, nombre: string, email: string } }>}
 */
// eslint-disable-next-line no-unused-vars
export async function iniciarSesion(_datos) {
  throw noImplementado('El inicio de sesion todavia no esta implementado (LET-13)');
}

/**
 * Devuelve los datos publicos del usuario de la sesion actual.
 * Epica LET-13.
 *
 * @param {string} _usuarioId
 * @returns {Promise<{ id: string, nombre: string, email: string }>}
 */
// eslint-disable-next-line no-unused-vars
export async function usuarioActual(_usuarioId) {
  throw noImplementado('La consulta del usuario actual todavia no esta implementada (LET-13)');
}

/** Cuanto vive un token de recuperacion antes de vencer. */
const MINUTOS_DE_VIGENCIA = 30;

/**
 * SHA-256 en hexadecimal del token en claro: lo unico que se guarda en la
 * base (`tokens_recuperacion.token_hash`). Interna del modulo: LET-15 la va a
 * reutilizar para verificar el token que llega en la confirmacion, no se
 * exporta para no volverla parte del contrato publico antes de tiempo.
 *
 * @param {string} token
 * @returns {string}
 */
function hashDeToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Inicia una recuperacion de contrasena. El controlador responde siempre el
 * mismo 200: esta funcion nunca revela si el correo existe.
 *
 * - Correo inexistente: se vuelve sin error y sin tocar la base.
 * - Se invalidan los tokens pendientes del usuario antes de crear uno nuevo:
 *   nunca queda mas de un enlace vigente a la vez.
 * - El token en claro sale de `randomBytes`, viaja una unica vez en el correo
 *   y solo su hash queda en la base.
 * - Si el envio del correo falla, el error se registra (sin el enlace ni el
 *   token: RNF-01) pero no se propaga. Que aparezca un 500 justo cuando la
 *   cuenta existe delataria lo mismo que un mensaje distinto.
 *
 * @param {{ email: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor, enviar?: typeof enviarCorreo }} [opciones] -
 *   `ejecutar` para las pruebas; `enviar` tambien, por si se quiere espiar o
 *   evitar el envio real sin tocar `CORREO_PROVEEDOR`.
 * @returns {Promise<void>}
 */
export async function pedirRecuperacion({ email }, { ejecutar, enviar = enviarCorreo } = {}) {
  const fila = await buscarUsuarioPorEmail(email.trim().toLowerCase(), ejecutar);
  if (!fila) return; // termina igual que si existiera: la ruta responde lo mismo

  await invalidarTokensPendientesDeUsuario(fila.id, ejecutar);

  const token = randomBytes(32).toString('base64url');
  await insertarToken(
    {
      usuario_id: fila.id,
      token_hash: hashDeToken(token),
      expira_en: new Date(Date.now() + MINUTOS_DE_VIGENCIA * 60 * 1000),
    },
    ejecutar,
  );

  const enlace = `${obtenerConfig().urlFrontend}/recuperar/${token}`;
  try {
    await enviar({
      para: fila.email,
      asunto: 'Recupera tu contrasena de Letrados',
      texto:
        `Pediste recuperar tu contrasena de Letrados. Entra a este enlace ` +
        `para elegir una nueva:\n\n${enlace}\n\n` +
        `El enlace vence en ${MINUTOS_DE_VIGENCIA} minutos y sirve una sola vez. ` +
        `Si no lo pediste vos, podes ignorar este mensaje.`,
    });
  } catch (error) {
    registrador.error(
      'No se pudo enviar el correo de recuperacion',
      { usuarioId: fila.id },
      error,
    );
  }
}

/**
 * Completa una recuperacion: valida el token de un solo uso y cambia la
 * contrasena. Token inexistente, vencido o ya usado dan el mismo error
 * (`TOKEN_INVALIDO`), sin distinguir cual fue.
 *
 * El sellado del token (`marcarTokenUsado`) va ANTES de cambiar la
 * contrasena. Al reves, dos peticiones simultaneas con el mismo enlace
 * cambiarian la contrasena dos veces; sellando primero, si el cambio falla
 * despues, el enlace queda quemado y la persona pide otro (peor para ella,
 * pero seguro). `marcarTokenUsado` devuelve `null` si el token ya estaba
 * usado: esa `null` es la proteccion contra dos peticiones a la vez.
 *
 * No inicia sesion ni devuelve nada: el frontend lleva al login.
 *
 * @param {{ token: string, contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<void>}
 */
export async function confirmarRecuperacion({ token, contrasena }, { ejecutar } = {}) {
  const fila = await buscarTokenVigentePorHash(hashDeToken(token), ejecutar);
  if (!fila) throw tokenInvalido();

  // Sellar antes de cambiar nada: si dos peticiones llegan con el mismo
  // enlace, solo una recibe la fila y la otra queda afuera.
  const usado = await marcarTokenUsado(fila.id, ejecutar);
  if (!usado) throw tokenInvalido();

  await actualizarContrasena(fila.usuario_id, await hashear(contrasena), ejecutar);
  await invalidarTokensPendientesDeUsuario(fila.usuario_id, ejecutar);
}
