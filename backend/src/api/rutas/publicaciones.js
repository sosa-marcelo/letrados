import express, { Router } from 'express';

import * as publicaciones from '../../domain/publicaciones.js';
import { autenticar } from '../middlewares/autenticar.js';
import { sesionOpcional } from '../middlewares/sesionOpcional.js';
import { esIdValido, validarPublicacion, validarNota } from '../validacion.js';

/**
 * Rutas de las publicaciones (modulo 4, epica LET-113, RF-14 a RF-16).
 *
 * Explorar, el detalle y la foto son publicos: pasan por `sesionOpcional`,
 * que solo sirve para marcar `esMia`. Publicar, cambiar la nota o la foto y
 * retirar exigen sesion. Una publicacion ajena responde 404, no 403.
 *
 * La foto viaja como cuerpo binario, con su Content-Type (LET-127): sin
 * multipart ni librerias nuevas. `express.raw` se monta solo en la ruta que
 * la recibe, con el tope de 2 MB; un cuerpo mas grande sale como 413 por el
 * manejador de errores, y uno de otro tipo no se parsea y llega sin Buffer.
 */
const rutasPublicaciones = Router();

const leerFoto = express.raw({ type: publicaciones.TIPOS_FOTO, limit: '2mb' });

// GET /api/publicaciones?q=&pagina=&porPagina= -> 200 { datos, paginacion }   (RF-15)
rutasPublicaciones.get('/publicaciones', sesionOpcional, async (req, res) => {
  const { q, pagina, porPagina } = req.query;
  res.json(
    await publicaciones.listarActivas({ q, pagina, porPagina }, { usuarioId: req.usuario?.id }),
  );
});

// GET /api/publicaciones/:id -> 200 { publicacion } | 404   (RF-16)
rutasPublicaciones.get('/publicaciones/:id', sesionOpcional, async (req, res) => {
  const publicacion = await publicaciones.verPublicacion(idPublicacion(req.params.id), {
    usuarioId: req.usuario?.id,
  });
  res.json({ publicacion });
});

// POST /api/publicaciones { libroId, nota? } -> 201 { publicacion } | 400 | 404 | 409   (RF-14)
rutasPublicaciones.post('/publicaciones', autenticar, async (req, res) => {
  const datos = validarPublicacion(req.body);
  const publicacion = await publicaciones.publicar(req.usuario.id, datos);
  res.status(201).json({ publicacion });
});

// PUT /api/publicaciones/:id { nota } -> 200 { publicacion } | 400 | 404 | 409   (RF-14)
rutasPublicaciones.put('/publicaciones/:id', autenticar, async (req, res) => {
  const id = idPublicacion(req.params.id);
  const publicacion = await publicaciones.modificarNota(req.usuario.id, id, validarNota(req.body));
  res.json({ publicacion });
});

// DELETE /api/publicaciones/:id -> 200 { resultado: 'retirada' } | 404 | 409   (RF-14)
rutasPublicaciones.delete('/publicaciones/:id', autenticar, async (req, res) => {
  res.json(await publicaciones.retirar(req.usuario.id, idPublicacion(req.params.id)));
});

// GET /api/publicaciones/:id/foto -> 200 bytes con su Content-Type | 404   (RF-16)
rutasPublicaciones.get('/publicaciones/:id/foto', async (req, res) => {
  const foto = await publicaciones.verFoto(idPublicacion(req.params.id));
  res.set('Cache-Control', 'public, max-age=300').type(foto.tipo).send(foto.bytes);
});

// PUT /api/publicaciones/:id/foto  cuerpo = la imagen -> 200 { publicacion } | 400 | 404 | 409 | 413   (RF-14)
rutasPublicaciones.put('/publicaciones/:id/foto', autenticar, leerFoto, async (req, res) => {
  const tipo = (req.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const publicacion = await publicaciones.subirFoto(req.usuario.id, idPublicacion(req.params.id), {
    tipo,
    bytes: req.body,
  });
  res.json({ publicacion });
});

// DELETE /api/publicaciones/:id/foto -> 200 { publicacion } | 404 | 409   (RF-14)
rutasPublicaciones.delete('/publicaciones/:id/foto', autenticar, async (req, res) => {
  const publicacion = await publicaciones.quitarFoto(req.usuario.id, idPublicacion(req.params.id));
  res.json({ publicacion });
});

/**
 * Un id que no es un entero positivo no puede ser una publicacion: 404
 * directo, sin mandarle a PostgreSQL un texto que fallaria como 500.
 *
 * @param {string} crudo
 * @returns {string}
 */
function idPublicacion(crudo) {
  if (!esIdValido(crudo)) throw publicaciones.publicacionNoEncontrada();
  return crudo;
}

export default rutasPublicaciones;
