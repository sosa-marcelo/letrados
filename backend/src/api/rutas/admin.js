import { Router } from 'express';

import * as admin from '../../domain/admin.js';
import { noEncontrado } from '../../domain/errores.js';
import { autenticar } from '../middlewares/autenticar.js';
import { exigirRol } from '../middlewares/exigirRol.js';
import { esIdValido } from '../validacion.js';

/**
 * Administracion de cuentas (RF-06, RF-07). Todo `/admin/*` pasa por
 * `autenticar` y `exigirRol('administrador')`: sin sesion 401, sin rol 403.
 */
const rutasAdmin = Router();

rutasAdmin.use('/admin', autenticar, exigirRol('administrador'));

// GET /api/admin/cuentas?q=&estado=&pagina=&porPagina= -> 200 { datos, paginacion }
rutasAdmin.get('/admin/cuentas', async (req, res) => {
  const { q, estado, pagina, porPagina } = req.query;
  res.json(await admin.listarCuentas({ q, estado, pagina, porPagina }));
});

// POST /api/admin/cuentas/:id/bloqueo -> 200 { cuenta } | 404 | 409
rutasAdmin.post('/admin/cuentas/:id/bloqueo', async (req, res) => {
  const cuenta = await admin.bloquearCuenta(req.usuario.id, idCuenta(req.params.id));
  res.json({ cuenta });
});

// DELETE /api/admin/cuentas/:id/bloqueo -> 200 { cuenta } | 404 | 409
rutasAdmin.delete('/admin/cuentas/:id/bloqueo', async (req, res) => {
  const cuenta = await admin.desbloquearCuenta(req.usuario.id, idCuenta(req.params.id));
  res.json({ cuenta });
});

function idCuenta(crudo) {
  if (!esIdValido(crudo)) throw noEncontrado('No encontramos esa cuenta');
  return crudo;
}

export default rutasAdmin;
