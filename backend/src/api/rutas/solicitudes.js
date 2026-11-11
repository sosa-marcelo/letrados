import { Router } from 'express';

import * as solicitudes from '../../domain/solicitudes.js';
import { reportar } from '../../domain/reportes.js';
import { autenticar } from '../middlewares/autenticar.js';
import { esIdValido, validarSolicitud, validarReporte } from '../validacion.js';

/**
 * Rutas de las solicitudes e intercambios (modulo 4, epica LET-114, RF-17 a
 * RF-21). Todas con sesion. Una solicitud de la que no sos parte responde
 * 404, no 403; el solicitante que intenta aceptar o rechazar recibe 403.
 *
 * Las acciones son verbos sobre la solicitud (`/aceptar`, `/rechazar`,
 * `/cancelar`, `/confirmar`) y devuelven la solicitud como queda, con `puedo`
 * al dia para que la interfaz redibuje los botones.
 */
const rutasSolicitudes = Router();

rutasSolicitudes.use('/solicitudes', autenticar);

// POST /api/solicitudes { publicacionId, libroOfrecidoId } -> 201 { solicitud } | 400 | 404 | 409   (RF-17)
rutasSolicitudes.post('/solicitudes', async (req, res) => {
  const solicitud = await solicitudes.solicitar(req.usuario.id, validarSolicitud(req.body));
  res.status(201).json({ solicitud });
});

// GET /api/solicitudes?rol=recibidas|enviadas&estado=&pagina=&porPagina= -> 200 { datos, paginacion }   (RF-18)
rutasSolicitudes.get('/solicitudes', async (req, res) => {
  const { rol, estado, pagina, porPagina } = req.query;
  res.json(await solicitudes.listar(req.usuario.id, { rol, estado, pagina, porPagina }));
});

// GET /api/solicitudes/:id -> 200 { solicitud } | 404   (RF-18)
rutasSolicitudes.get('/solicitudes/:id', async (req, res) => {
  res.json({ solicitud: await solicitudes.ver(req.usuario.id, idSolicitud(req.params.id)) });
});

// POST /api/solicitudes/:id/aceptar|rechazar|cancelar|confirmar -> 200 { solicitud } | 403 | 404 | 409
const ACCIONES = {
  aceptar: solicitudes.aceptar, // RF-19
  rechazar: solicitudes.rechazar, // RF-19
  cancelar: solicitudes.cancelar, // RF-20
  confirmar: solicitudes.confirmar, // RF-21
};
for (const [accion, hacer] of Object.entries(ACCIONES)) {
  rutasSolicitudes.post(`/solicitudes/:id/${accion}`, async (req, res) => {
    res.json({ solicitud: await hacer(req.usuario.id, idSolicitud(req.params.id)) });
  });
}

// POST /api/solicitudes/:id/reportes { descripcion } -> 201 { reporte } | 400 | 404 | 409   (RF-24)
rutasSolicitudes.post('/solicitudes/:id/reportes', async (req, res) => {
  const reporte = await reportar(req.usuario.id, idSolicitud(req.params.id), validarReporte(req.body));
  res.status(201).json({ reporte });
});

/**
 * Un id que no es un entero positivo no puede ser una solicitud: 404 directo.
 *
 * @param {string} crudo
 * @returns {string}
 */
function idSolicitud(crudo) {
  if (!esIdValido(crudo)) throw solicitudes.solicitudNoEncontrada();
  return crudo;
}

export default rutasSolicitudes;
