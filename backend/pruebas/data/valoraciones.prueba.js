import { describe, it, expect, beforeEach } from 'vitest';

import { insertarValoracion, valoracionDe, valoracionesRecibidas } from '../../src/data/valoraciones.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
let solicitudId;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  ana = (await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id;
  beto = (await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id;
  const libro = async (u, titulo) =>
    (await ejecutar(`INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, $2, 'a', 1) RETURNING id`, [u, titulo])).rows[0].id;
  const p = (await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [await libro(ana, 'Rayuela'), ana])).rows[0].id;
  solicitudId = (
    await ejecutar(
      `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id, estado) VALUES ($1, $2, $3, 'completada') RETURNING id`,
      [p, beto, await libro(beto, 'Ficciones')],
    )
  ).rows[0].id;
});

const valorar = (autor, valorado, puntaje = 5) =>
  ejecutar(
    `INSERT INTO valoraciones (solicitud_id, autor_id, valorado_id, puntaje) VALUES ($1, $2, $3, $4) RETURNING *`,
    [solicitudId, autor, valorado, puntaje],
  );

describe('migracion 009: valoraciones', () => {
  it('guarda la valoracion con comentario opcional en null', async () => {
    const { rows } = await valorar(beto, ana, 4);
    expect(rows[0]).toMatchObject({ puntaje: 4, comentario: null });
  });

  it.each([0, 6])('rechaza el puntaje %i', async (puntaje) => {
    await expect(valorar(beto, ana, puntaje)).rejects.toThrow();
  });

  it('una sola valoracion por parte e intercambio; la otra parte puede valorar', async () => {
    await valorar(beto, ana);
    await expect(valorar(beto, ana)).rejects.toThrow();
    await expect(valorar(ana, beto)).resolves.toBeTruthy();
  });

  it('nadie se valora a si mismo', async () => {
    await expect(valorar(ana, ana)).rejects.toThrow();
  });
});

describe('capa de datos de valoraciones (LET-166)', () => {
  it('insertarValoracion y valoracionDe', async () => {
    expect(await valoracionDe(solicitudId, beto, ejecutar)).toBeNull();
    const v = await insertarValoracion({ solicitud_id: solicitudId, autor_id: beto, valorado_id: ana, puntaje: 4, comentario: 'Bien' }, ejecutar);
    expect(v).toMatchObject({ puntaje: 4, comentario: 'Bien' });
    expect(await valoracionDe(solicitudId, beto, ejecutar)).toMatchObject({ puntaje: 4 });
  });

  it('el UNIQUE devuelve el codigo 23505, que el dominio traduce a 409', async () => {
    await insertarValoracion({ solicitud_id: solicitudId, autor_id: beto, valorado_id: ana, puntaje: 4 }, ejecutar);
    await expect(
      insertarValoracion({ solicitud_id: solicitudId, autor_id: beto, valorado_id: ana, puntaje: 5 }, ejecutar),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('valoracionesRecibidas trae autor y titulos, y pagina', async () => {
    await insertarValoracion({ solicitud_id: solicitudId, autor_id: beto, valorado_id: ana, puntaje: 5 }, ejecutar);
    const { filas, total } = await valoracionesRecibidas(ana, { limite: 10, desplazamiento: 0 }, ejecutar);
    expect(total).toBe(1);
    expect(filas[0]).toMatchObject({ autor_nombre: 'Beto', solicitado_titulo: 'Rayuela', ofrecido_titulo: 'Ficciones' });
    expect((await valoracionesRecibidas(ana, { limite: 10, desplazamiento: 1 }, ejecutar)).filas).toEqual([]);
  });
});
