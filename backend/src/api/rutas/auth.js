import { Router } from 'express';

import * as auth from '../../domain/auth.js';
import { autenticar } from '../middlewares/autenticar.js';
import {
  validarRegistro,
  validarLogin,
  validarPedidoRecuperacion,
  validarConfirmacionRecuperacion,
} from '../validacion.js';

/**
 * Rutas de autenticacion. LET-18 congela el contrato: rutas, validacion de
 * entrada y forma de la respuesta. La logica vive en `domain/auth.js`, que hoy
 * responde 501; cada epica siguiente rellena su funcion sin tocar este archivo.
 */
const rutasAuth = Router();

/** Campos publicos de un usuario. Nunca sale el hash ni `creado_en` por aca. */
function vistaPublica(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
}

// POST /api/auth/registro -> 201 { token, usuario } | 409 EMAIL_DUPLICADO | 400 DATOS_INVALIDOS
rutasAuth.post('/auth/registro', async (req, res) => {
  const datos = validarRegistro(req.body);
  const { token, usuario } = await auth.registrar(datos);
  res.status(201).json({ token, usuario: vistaPublica(usuario) });
});

// POST /api/auth/login -> 200 { token, usuario } | 401 CREDENCIALES_INVALIDAS
// El mensaje de error de credenciales lo fija domain, y es siempre el mismo:
// nunca se dice si fallo el correo o la contrasena.
rutasAuth.post('/auth/login', async (req, res) => {
  const datos = validarLogin(req.body);
  const { token, usuario } = await auth.iniciarSesion(datos);
  res.json({ token, usuario: vistaPublica(usuario) });
});

// GET /api/auth/yo -> 200 { usuario } | 401 SESION_INVALIDA
rutasAuth.get('/auth/yo', autenticar, async (req, res) => {
  const usuario = await auth.usuarioActual(req.usuario.id);
  res.json({ usuario: vistaPublica(usuario) });
});

// POST /api/auth/recuperacion -> 200 SIEMPRE, mismo cuerpo exista o no la cuenta.
// domain no debe lanzar por "correo inexistente": eso revelaria que la cuenta
// existe. (Durante el freeze responde 501 como el resto.)
rutasAuth.post('/auth/recuperacion', async (req, res) => {
  const datos = validarPedidoRecuperacion(req.body);
  await auth.pedirRecuperacion(datos);
  res.json({
    mensaje: 'Si el correo esta registrado, te enviamos un enlace para recuperar la contrasena.',
  });
});

// POST /api/auth/recuperacion/confirmar -> 200 | 400 TOKEN_INVALIDO
rutasAuth.post('/auth/recuperacion/confirmar', async (req, res) => {
  const datos = validarConfirmacionRecuperacion(req.body);
  await auth.confirmarRecuperacion(datos);
  res.json({ mensaje: 'Tu contrasena fue actualizada. Ya podes iniciar sesion.' });
});

export default rutasAuth;
