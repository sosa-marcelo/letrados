import { Router } from 'express';

import * as libros from '../../domain/libros.js';
import { autenticar } from '../middlewares/autenticar.js';
import { validarLibro, esIdValido } from '../validacion.js';

/**
 * Rutas del catalogo propio (modulo 3, RF-10 a RF-13). Todas con sesion: cada
 * persona solo ve y toca su propio catalogo. Un libro ajeno responde 404, no
 * 403, para no confirmar que ese id existe (DISENIO-GENERAL §7.3).
 */
const rutasLibros = Router();

rutasLibros.use('/libros', autenticar);

// GET /api/libros?q=&pagina=&porPagina= -> 200 { datos, paginacion }   (RF-13)
rutasLibros.get('/libros', async (req, res) => {
  const { q, pagina, porPagina } = req.query;
  res.json(await libros.listarLibros(req.usuario.id, { q, pagina, porPagina }));
});

// POST /api/libros -> 201 { libro } | 400 DATOS_INVALIDOS   (RF-10)
rutasLibros.post('/libros', async (req, res) => {
  const datos = validarLibro(req.body);
  const libro = await libros.agregarLibro(req.usuario.id, datos);
  res.status(201).json({ libro });
});

// PUT /api/libros/:id -> 200 { libro } | 400 | 404 NO_ENCONTRADO | 409 ESTADO_INVALIDO   (RF-11)
rutasLibros.put('/libros/:id', async (req, res) => {
  const id = idValido(req.params.id);
  const datos = validarLibro(req.body);
  const libro = await libros.modificarLibro(req.usuario.id, id, datos);
  res.json({ libro });
});

// DELETE /api/libros/:id -> 200 { resultado: 'archivado' | 'eliminado' } | 404 | 409   (RF-12)
rutasLibros.delete('/libros/:id', async (req, res) => {
  const id = idValido(req.params.id);
  res.json(await libros.retirarLibro(req.usuario.id, id));
});

/**
 * Un id que no es un entero positivo no puede ser un libro: 404 directo, sin
 * mandarle a PostgreSQL un texto que haria fallar el cast del BIGINT (500).
 *
 * @param {string} crudo
 * @returns {string}
 */
function idValido(crudo) {
  if (!esIdValido(crudo)) {
    throw libros.libroNoEncontrado();
  }
  return crudo;
}

export default rutasLibros;
