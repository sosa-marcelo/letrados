import { describe, it, expect, beforeEach } from 'vitest';

import { guardarFoto, borrarFoto, leerFoto } from '../../src/data/fotos.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let publicacionId;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  const duenio = (await sembrarUsuario(ejecutar)).id;
  const libro = (
    await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 'Rayuela', 'Cortázar', 1) RETURNING id`,
      [duenio],
    )
  ).rows[0];
  publicacionId = (
    await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [libro.id, duenio])
  ).rows[0].id;
});

describe('capa de datos de fotos (LET-125)', () => {
  it('sin foto, leerFoto devuelve null y borrarFoto false', async () => {
    expect(await leerFoto(publicacionId, ejecutar)).toBeNull();
    expect(await borrarFoto(publicacionId, ejecutar)).toBe(false);
  });

  it('guarda, reemplaza y borra la foto', async () => {
    await guardarFoto(publicacionId, { tipo: 'image/jpeg', contenido: '/9j/4A==' }, ejecutar);
    expect(await leerFoto(publicacionId, ejecutar)).toMatchObject({ tipo: 'image/jpeg', contenido: '/9j/4A==' });

    await guardarFoto(publicacionId, { tipo: 'image/png', contenido: 'iVBORw==' }, ejecutar);
    expect(await leerFoto(publicacionId, ejecutar)).toMatchObject({ tipo: 'image/png', contenido: 'iVBORw==' });

    expect(await borrarFoto(publicacionId, ejecutar)).toBe(true);
    expect(await leerFoto(publicacionId, ejecutar)).toBeNull();
  });
});
