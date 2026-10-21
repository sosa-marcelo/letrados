import { createHash, randomBytes } from 'node:crypto';

import {
  emailDuplicado,
  credencialesInvalidas,
  cuentaBloqueada,
  sesionInvalida,
  tokenInvalido,
} from './errores.js';
import { hashear, verificar as verificarContrasena } from '../infra/hash.js';
import { firmar, vencimientoDe } from '../infra/jwt.js';
import { nuevoJti } from '../infra/sesiones.js';
import { enviarCorreo } from '../infra/correo.js';
import { obtenerConfig } from '../infra/config.js';
import { registrador } from '../infra/registrador.js';
import { insertarSesion, revocarSesion } from '../data/sesiones.js';
import {
  insertarUsuario,
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  actualizarContrasena,
} from '../data/usuarios.js';
import {
  insertarToken,
  buscarTokenVigentePorHash,
  marcarTokenUsado,
  invalidarTokensPendientesDeUsuario,
} from '../data/tokens.js';

/**
 * Hash bcrypt de coste 12 de un valor descartable (un UUID al azar, generado
 * una sola vez). No es un secreto de nadie: solo sirve para que
 * `verificarContrasena` tenga algo con que comparar cuando el correo no
 * existe, y asi la respuesta tarde lo mismo exista o no la cuenta (ver
 * `iniciarSesion`). Coste 12 porque un coste menor comparara mas rapido que
 * el hash real y el tiempo volveria a delatar cuentas.
 */
const HASH_FICTICIO = '$2b$12$tteIclI8DI10MR5pEIt3W.1Dzjp9uTqpZzV8WB6jDXhX9GGWCUv2S';

/**
 * Reglas de negocio de autenticacion.
 *
 * LET-18 congelo el contrato: cada funcion existe con su firma definitiva.
 * Las cuatro funciones estan implementadas: registro, login, usuario actual y recuperacion.
 *
 * Ninguna funcion conoce HTTP: reciben datos planos y devuelven datos planos o
 * lanzan `ErrorDominio`.
 */

/** Codigo que PostgreSQL (y `pg-mem`) usan para una violacion de unicidad. */
const VIOLACION_UNICIDAD = '23505';

/**
 * @typedef {{ id: string, nombre: string, email: string, rol: string }} UsuarioSesion
 */

/** Lo que el resto del sistema ve de una fila de `usuarios` con sesion. */
function vistaUsuario(fila) {
  return { id: String(fila.id), nombre: fila.nombre, email: fila.email, rol: fila.rol };
}

/**
 * Abre una sesion para un usuario: genera el `jti`, firma el token con
 * `{ sub, rol, jti }` e inserta la fila en `sesiones` con el mismo vencimiento
 * que el token. Sin la fila, `autenticar` rechaza el token.
 *
 * @param {{ id: string, rol: string }} usuario
 * @param {import('../data/usuarios.js').Ejecutor} [ejecutar]
 * @returns {Promise<string>} el token firmado.
 */
async function abrirSesion(usuario, ejecutar) {
  const jti = nuevoJti();
  const token = firmar(usuario.id, { rol: usuario.rol, jti });
  await insertarSesion(
    { jti, usuario_id: usuario.id, expira_en: vencimientoDe(token) },
    ejecutar,
  );
  return token;
}

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
 * @returns {Promise<{ token: string, usuario: UsuarioSesion }>}
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

  // El rol lo pone el DEFAULT de la columna (RF-06); el registro no lo elige.
  const usuario = vistaUsuario(fila);
  return { token: await abrirSesion(usuario, ejecutar), usuario };
}

/**
 * Valida credenciales y devuelve una sesion. Ante cualquier fallo lanza
 * `CREDENCIALES_INVALIDAS`, siempre con el mismo mensaje: nunca distingue si
 * fallo el correo o la contrasena.
 *
 * Compara la contrasena aunque el usuario no exista (contra `HASH_FICTICIO`):
 * asi las dos respuestas de error tardan lo mismo. Si solo se comparara cuando
 * el usuario existe, el tiempo de respuesta delataria que correos estan
 * registrados.
 *
 * Con credenciales correctas, una cuenta bloqueada o eliminada responde 403
 * `CUENTA_BLOQUEADA` (RF-02, DISENIO-GENERAL §7.4): solo llega ahi quien ya
 * probo saber la contrasena. Si esta activa, se abre una sesion revocable.
 *
 * @param {{ email: string, contrasena: string }} datos
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ token: string, usuario: UsuarioSesion }>}
 */
export async function iniciarSesion({ email, contrasena }, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorEmail(email.trim().toLowerCase(), ejecutar);

  // Se compara aunque el usuario no exista, para que las dos respuestas
  // de error tarden lo mismo: si no, el tiempo delata que cuentas existen.
  const coincide = await verificarContrasena(contrasena, fila?.contrasena_hash ?? HASH_FICTICIO);
  if (!fila || !coincide) throw credencialesInvalidas();
  if (fila.estado !== 'activa') throw cuentaBloqueada();

  const usuario = vistaUsuario(fila);
  return { token: await abrirSesion(usuario, ejecutar), usuario };
}

/**
 * Cierra una sesion en el servidor (RF-03): revoca la fila del `jti`.
 * **Idempotente**: cerrar una sesion ya cerrada no es un error, para que el
 * cliente que reintenta por una desconexion no vea un fallo.
 *
 * @param {string} jti
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<void>}
 */
export async function cerrarSesion(jti, { ejecutar } = {}) {
  await revocarSesion(jti, ejecutar);
}

/**
 * Devuelve los datos del usuario de la sesion actual, con su rol. El id ya
 * viene validado por el middleware `autenticar`; si de todos modos no
 * corresponde a nadie, la sesion se trata como invalida.
 *
 * @param {string} usuarioId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<UsuarioSesion>}
 */
export async function usuarioActual(usuarioId, { ejecutar } = {}) {
  const fila = await buscarUsuarioPorId(usuarioId, ejecutar);
  if (!fila) throw sesionInvalida();
  return vistaUsuario(fila);
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
