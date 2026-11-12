import { describe, it, expect, beforeEach } from 'vitest';

import { reputacionDe, reputacionesDe, SIN_VALORACIONES } from '../../src/domain/reputacion.js';
import { reputacionDe as reexportada } from '../../src/domain/perfil.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
});

/** Intercambio completado entre propietario y solicitante; devuelve el id de la solicitud. */
async function completado(propietario, solicitante) {
  const libro = async (u) =>
    (await ejecutar(`INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 't', 'a', 1) RETURNING id`, [u])).rows[0].id;
  const p = (await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [await libro(propietario), propietario])).rows[0].id;
  return (await ejecutar(
    `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id, estado) VALUES ($1, $2, $3, 'completada') RETURNING id`,
    [p, solicitante, await libro(solicitante)],
  )).rows[0].id;
}

const valorar = (solicitudId, autor, valorado, puntaje) =>
  ejecutar(
    `INSERT INTO valoraciones (solicitud_id, autor_id, valorado_id, puntaje) VALUES ($1, $2, $3, $4)`,
    [solicitudId, autor, valorado, puntaje],
  );

describe('reputacion (LET-164)', () => {
  it('promedio con un decimal y cantidad, con dos valoraciones de personas distintas', async () => {
    const ana = (await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id;
    const beto = (await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id;
    const carla = (await sembrarUsuario(ejecutar, { nombre: 'Carla', email: 'carla@ejemplo.com' })).id;

    await valorar(await completado(ana, beto), beto, ana, 5);
    await valorar(await completado(ana, carla), carla, ana, 4);

    expect(await reputacionDe(String(ana), { ejecutar })).toEqual({ promedio: 4.5, cantidad: 2 });
  });

  it('sin valoraciones: promedio null y cantidad 0', async () => {
    const ana = (await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id;
    expect(await reputacionDe(String(ana), { ejecutar })).toEqual(SIN_VALORACIONES);
  });

  it('en lote: el que tiene valoraciones y el que no aparecen los dos en el mapa', async () => {
    const ana = (await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id;
    const beto = (await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id;
    await valorar(await completado(ana, beto), beto, ana, 5);

    const mapa = await reputacionesDe([String(ana), String(beto)], { ejecutar });
    expect([...mapa.keys()]).toEqual([String(ana), String(beto)]);
    expect(mapa.get(String(ana))).toEqual({ promedio: 5, cantidad: 1 });
    expect(mapa.get(String(beto))).toEqual(SIN_VALORACIONES);
  });

  it('lista vacia: mapa vacio, sin consultar', async () => {
    expect(await reputacionesDe([], { ejecutar })).toEqual(new Map());
  });

  it('redondea a un decimal: 5, 5 y 4 da 4,7', async () => {
    const dana = (await sembrarUsuario(ejecutar, { nombre: 'Dana', email: 'dana@ejemplo.com' })).id;
    const beto = (await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id;
    const carla = (await sembrarUsuario(ejecutar, { nombre: 'Carla', email: 'carla@ejemplo.com' })).id;
    const elan = (await sembrarUsuario(ejecutar, { nombre: 'Elan', email: 'elan@ejemplo.com' })).id;

    await valorar(await completado(dana, beto), beto, dana, 5);
    await valorar(await completado(dana, carla), carla, dana, 5);
    await valorar(await completado(dana, elan), elan, dana, 4);

    expect(await reputacionDe(String(dana), { ejecutar })).toEqual({ promedio: 4.7, cantidad: 3 });
  });

  it('perfil.js la sigue exportando', () => {
    expect(reexportada).toBe(reputacionDe);
  });
});
