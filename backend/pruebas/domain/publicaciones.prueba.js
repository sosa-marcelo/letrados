import { describe, it, expect, beforeEach } from 'vitest';

import {
  publicar,
  modificarNota,
  retirar,
  vistaPublicacion,
} from '../../src/domain/publicaciones.js';
import { agregarLibro } from '../../src/domain/libros.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
let rayuela;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  ana = String((await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id);
  beto = String((await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id);
  rayuela = await agregarLibro(
    ana,
    { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 2, editorial: 'Sudamericana', anio: 1963 },
    { ejecutar },
  );
});

/** Corre `fn` y devuelve el error de dominio que lanza. */
async function errorDe(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

async function estadoDe(publicacionId) {
  const { rows } = await ejecutar('SELECT estado FROM publicaciones WHERE id = $1', [publicacionId]);
  return rows[0].estado;
}

describe('publicar (RF-14)', () => {
  it('crea la publicacion activa con el libro al dia, su dueño y la nota', async () => {
    const p = await publicar(ana, { libroId: rayuela.id, nota: 'En el centro' }, { ejecutar });
    expect(p).toMatchObject({
      estado: 'activa',
      nota: 'En el centro',
      tieneFoto: false,
      esMia: true,
      libro: {
        id: rayuela.id,
        titulo: 'Rayuela',
        autor: 'Julio Cortázar',
        editorial: 'Sudamericana',
        anio: 1963,
        disponible: 2,
      },
      propietario: { id: ana, nombre: 'Ana', reputacion: { promedio: null, cantidad: 0 } },
    });
  });

  it('sin nota la deja en null', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    expect(p.nota).toBeNull();
  });

  it('un libro ya publicado -> 409 ESTADO_INVALIDO', async () => {
    await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const error = await errorDe(() => publicar(ana, { libroId: rayuela.id }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toMatch(/ya está publicado/);
  });

  it('un libro sin ejemplares disponibles -> 409 con el motivo', async () => {
    await ejecutar('UPDATE libros SET cantidad_reservada = 2 WHERE id = $1', [rayuela.id]);
    const error = await errorDe(() => publicar(ana, { libroId: rayuela.id }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    expect(error.message).toMatch(/no tiene ejemplares disponibles/);
  });

  it('un libro ajeno, inexistente o archivado -> 404 NO_ENCONTRADO', async () => {
    expect(await errorDe(() => publicar(beto, { libroId: rayuela.id }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    expect(await errorDe(() => publicar(ana, { libroId: '999' }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await ejecutar('UPDATE libros SET archivado_en = now() WHERE id = $1', [rayuela.id]);
    expect(await errorDe(() => publicar(ana, { libroId: rayuela.id }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('despues de retirarla, el libro se puede volver a publicar', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await retirar(ana, p.id, { ejecutar });
    await expect(publicar(ana, { libroId: rayuela.id }, { ejecutar })).resolves.toMatchObject({
      estado: 'activa',
    });
  });
});

describe('modificarNota (RF-14)', () => {
  it('reemplaza la nota y tambien la borra con null', async () => {
    const p = await publicar(ana, { libroId: rayuela.id, nota: 'a' }, { ejecutar });
    expect((await modificarNota(ana, p.id, { nota: 'b' }, { ejecutar })).nota).toBe('b');
    expect((await modificarNota(ana, p.id, { nota: null }, { ejecutar })).nota).toBeNull();
  });

  it('una publicacion ajena -> 404 y no la toca', async () => {
    const p = await publicar(ana, { libroId: rayuela.id, nota: 'a' }, { ejecutar });
    const error = await errorDe(() => modificarNota(beto, p.id, { nota: 'b' }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'NO_ENCONTRADO', estado: 404 });
  });

  it.each([
    ['reservada', /solicitud aceptada/],
    ['cerrada', /cerrada/],
    ['retirada', /ya fue retirada/],
  ])('una publicacion %s -> 409 con el motivo', async (estado, motivo) => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await ejecutar('UPDATE publicaciones SET estado = $2 WHERE id = $1', [p.id, estado]);
    const error = await errorDe(() => modificarNota(ana, p.id, { nota: 'b' }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toMatch(motivo);
  });
});

describe('retirar (RF-14)', () => {
  it('pasa la publicacion a retirada', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    expect(await retirar(ana, p.id, { ejecutar })).toEqual({ resultado: 'retirada' });
    expect(await estadoDe(p.id)).toBe('retirada');
  });

  it('una reservada -> 409 y sigue reservada', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await ejecutar(`UPDATE publicaciones SET estado = 'reservada' WHERE id = $1`, [p.id]);
    expect(await errorDe(() => retirar(ana, p.id, { ejecutar }))).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    expect(await estadoDe(p.id)).toBe('reservada');
  });

  it('una ajena o inexistente -> 404', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    expect(await errorDe(() => retirar(beto, p.id, { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(await errorDe(() => retirar(ana, '999', { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});

describe('vistaPublicacion', () => {
  it('esMia solo cuando quien consulta es el dueño', () => {
    const fila = {
      id: 1,
      libro_id: 2,
      usuario_id: 3,
      estado: 'activa',
      titulo: 't',
      autor: 'a',
      cantidad_total: 1,
      cantidad_reservada: 0,
      propietario_nombre: 'Ana',
      creada_en: new Date(),
    };
    expect(vistaPublicacion(fila).esMia).toBe(false);
    expect(vistaPublicacion(fila, { usuarioId: '3' }).esMia).toBe(true);
    expect(vistaPublicacion(fila, { usuarioId: '4' }).esMia).toBe(false);
    expect(vistaPublicacion(fila).libro).toMatchObject({ editorial: null, disponible: 1 });
  });
});
