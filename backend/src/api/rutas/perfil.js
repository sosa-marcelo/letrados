import { Router } from 'express';

import * as perfil from '../../domain/perfil.js';
import { noEncontrado } from '../../domain/errores.js';
import { autenticar } from '../middlewares/autenticar.js';
import { validarBaja, esIdValido, validarCambioContrasena } from '../validacion.js';

/**
 * Perfil propio (RF-05), perfil publico (RF-08) y baja de cuenta (RF-09).
 * `PUT /api/perfil` lo suma LET-65.
 */
const rutasPerfil = Router();

// GET /api/perfil -> 200 { perfil } | 401   (RF-05) · el unico lugar con el correo
rutasPerfil.get('/perfil', autenticar, async (req, res) => {
  res.json({ perfil: await perfil.verPerfil(req.usuario.id) });
});

// DELETE /api/perfil { contrasena } -> 200 { ok: true } | 400 | 401 CONTRASENA_INCORRECTA   (RF-09)
rutasPerfil.delete('/perfil', autenticar, async (req, res) => {
  const datos = validarBaja(req.body);
  await perfil.darDeBaja(req.usuario.id, datos);
  res.json({ ok: true });
});

// GET /api/usuarios/:id -> 200 { usuario } | 404   (RF-08) · publico, sin sesion
rutasPerfil.get('/usuarios/:id', async (req, res) => {
  if (!esIdValido(req.params.id)) throw noEncontrado('No encontramos esa cuenta');
  res.json({ usuario: await perfil.perfilPublico(req.params.id) });
});

// PUT /api/perfil/contrasena { contrasenaActual, contrasenaNueva } -> 200 { ok: true } | 400 | 401 CONTRASENA_INCORRECTA | 401 SESION_INVALIDA   (RF-05)
rutasPerfil.put('/perfil/contrasena', autenticar, async (req, res) => {
  const datos = validarCambioContrasena(req.body);
  await perfil.cambiarContrasena(req.usuario, datos);
  res.json({ ok: true });
});

export default rutasPerfil;
