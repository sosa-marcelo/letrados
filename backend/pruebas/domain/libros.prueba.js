import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  agregarLibro,
  modificarLibro,
  retirarLibro,
  listarLibros,
  disponiblesDe,
  vistaLibro,
  POR_PAGINA_MAX,
} from '../../src/domain/libros.js';
import * as datosLibros from '../../src/data/libros.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
beforeEach(async () => {
  vi.restoreAllMocks();
  ({ ejecutar } = await crearBdMemoria());
  ana = String((await sembrarUsuario(ejecutar, { email: 'ana@ejemplo.com' })).id);
  beto = String((await sembrarUsuario(ejecutar, { email: 'beto@ejemplo.com' })).id);
});

const RAYUELA = { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 2 };

/** Simula lo que hara el modulo 4 al aceptar un intercambio. */
async function reservar(libroId, n) {
  await ejecutar('UPDATE libros SET cantidad_reservada = $2 WHERE id = $1', [libroId, n]);
}

describe('disponiblesDe y vistaLibro', () => {
  it('disponible = total - reservada', () => {
    expect(disponiblesDe({ cantidad_total: 3, cantidad_reservada: 1 })).toBe(2);
    expect(disponiblesDe({ cantidad_total: 1, cantidad_reservada: 1 })).toBe(0);
  });

  it('expone los tres numeros y no el usuario_id ni archivado_en', async () => {
    const libro = await agregarLibro(ana, RAYUELA, { ejecutar });
    expect(Object.keys(libro).sort()).toEqual(
      ['autor', 'creadoEn', 'disponible', 'id', 'publicado', 'reservada', 'tieneHistorial', 'titulo', 'total'],
    );
    expect(vistaLibro({ id: 1, titulo: 't', autor: 'a', cantidad_total: 1, cantidad_reservada: 0, creado_en: new Date() }, { publicado: true }).publicado).toBe(true);
  });
});

describe('agregarLibro (RF-10)', () => {
  it('lo crea con reservada 0 y disponible = cantidad', async () => {
    const libro = await agregarLibro(ana, RAYUELA, { ejecutar });
    expect(libro).toMatchObject({
      titulo: 'Rayuela',
      autor: 'Julio Cortázar',
      total: 2,
      reservada: 0,
      disponible: 2,
      publicado: false,
      tieneHistorial: false,
    });
    expect(typeof libro.id).toBe('string');
  });

  it('dos libros con el mismo titulo del mismo dueño son legitimos', async () => {
    await agregarLibro(ana, RAYUELA, { ejecutar });
    await agregarLibro(ana, RAYUELA, { ejecutar });
    const { paginacion } = await listarLibros(ana, {}, { ejecutar });
    expect(paginacion.total).toBe(2);
  });
});

describe('modificarLibro (RF-11)', () => {
  it('reemplaza titulo, autor y cantidad', async () => {
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });
    const libro = await modificarLibro(
      ana,
      id,
      { titulo: 'Rayuela (2ª ed.)', autor: 'Cortázar', cantidad: 5 },
      { ejecutar },
    );
    expect(libro).toMatchObject({ titulo: 'Rayuela (2ª ed.)', autor: 'Cortázar', total: 5 });
  });

  it('bajar por debajo de lo reservado -> 409 ESTADO_INVALIDO y el mensaje dice el minimo', async () => {
    const { id } = await agregarLibro(ana, { ...RAYUELA, cantidad: 4 }, { ejecutar });
    await reservar(id, 3);

    const error = await modificarLibro(ana, id, { ...RAYUELA, cantidad: 2 }, { ejecutar }).catch(
      (e) => e,
    );
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toContain('3');
    expect(error.detalles[0].campo).toBe('cantidad');

    // Y la fila no cambio (la transaccion se deshizo).
    const { datos } = await listarLibros(ana, {}, { ejecutar });
    expect(datos[0].total).toBe(4);
  });

  it('con 1 reservado, el mensaje usa el singular', async () => {
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });
    await reservar(id, 1);
    await expect(
      modificarLibro(ana, id, { ...RAYUELA, cantidad: 0 }, { ejecutar }),
    ).rejects.toThrow(/1 ejemplar reservado/);
  });

  it('bajar justo hasta lo reservado esta permitido', async () => {
    const { id } = await agregarLibro(ana, { ...RAYUELA, cantidad: 4 }, { ejecutar });
    await reservar(id, 3);
    const libro = await modificarLibro(ana, id, { ...RAYUELA, cantidad: 3 }, { ejecutar });
    expect(libro).toMatchObject({ total: 3, reservada: 3, disponible: 0 });
  });

  it('libro ajeno -> 404 NO_ENCONTRADO (no 403)', async () => {
    const { id } = await agregarLibro(beto, RAYUELA, { ejecutar });
    await expect(modificarLibro(ana, id, RAYUELA, { ejecutar })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      estado: 404,
    });
  });

  it('libro inexistente -> 404', async () => {
    await expect(modificarLibro(ana, '999', RAYUELA, { ejecutar })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('libro archivado -> 404', async () => {
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });
    await ejecutar('UPDATE libros SET archivado_en = now() WHERE id = $1', [id]);
    await expect(modificarLibro(ana, id, RAYUELA, { ejecutar })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('retirarLibro (RF-12)', () => {
  it('sin publicaciones ni historial -> eliminado y la fila desaparece', async () => {
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });
    expect(await retirarLibro(ana, id, { ejecutar })).toEqual({ resultado: 'eliminado' });
    const { rows } = await ejecutar('SELECT * FROM libros WHERE id = $1', [id]);
    expect(rows).toHaveLength(0);
  });

  it('con intercambios completados -> archivado: la fila queda y sale del catalogo', async () => {
    vi.spyOn(datosLibros, 'tieneIntercambiosCompletados').mockResolvedValue(true);
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });

    expect(await retirarLibro(ana, id, { ejecutar })).toEqual({ resultado: 'archivado' });

    const { rows } = await ejecutar('SELECT archivado_en FROM libros WHERE id = $1', [id]);
    expect(rows[0].archivado_en).not.toBeNull();
    expect((await listarLibros(ana, {}, { ejecutar })).datos).toHaveLength(0);
  });

  it('con publicacion activa o solicitud abierta -> 409 enumerando el estorbo', async () => {
    vi.spyOn(datosLibros, 'contarEstorbosDeRetiro').mockResolvedValue({
      publicaciones: 1,
      intercambios: 2,
    });
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });

    const error = await retirarLibro(ana, id, { ejecutar }).catch((e) => e);
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.detalles).toHaveLength(2);

    // No se borro.
    const { rows } = await ejecutar('SELECT id FROM libros WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('solo publicaciones -> un unico detalle', async () => {
    vi.spyOn(datosLibros, 'contarEstorbosDeRetiro').mockResolvedValue({
      publicaciones: 1,
      intercambios: 0,
    });
    const { id } = await agregarLibro(ana, RAYUELA, { ejecutar });
    const error = await retirarLibro(ana, id, { ejecutar }).catch((e) => e);
    expect(error.detalles).toHaveLength(1);
  });

  it('libro ajeno -> 404 y no lo toca', async () => {
    const { id } = await agregarLibro(beto, RAYUELA, { ejecutar });
    await expect(retirarLibro(ana, id, { ejecutar })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    const { rows } = await ejecutar('SELECT id FROM libros WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });
});

describe('listarLibros (RF-13)', () => {
  beforeEach(async () => {
    await agregarLibro(ana, { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 1 }, { ejecutar });
    await agregarLibro(ana, { titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', cantidad: 2 }, { ejecutar });
    await agregarLibro(ana, { titulo: 'Ficciones', autor: 'Jorge Luis Borges', cantidad: 1 }, { ejecutar });
    await agregarLibro(beto, { titulo: 'El Aleph', autor: 'Jorge Luis Borges', cantidad: 1 }, { ejecutar });
  });

  it('solo el catalogo propio, del mas nuevo al mas viejo', async () => {
    const { datos, paginacion } = await listarLibros(ana, {}, { ejecutar });
    expect(datos.map((l) => l.titulo)).toEqual(['Ficciones', 'Cien años de soledad', 'Rayuela']);
    expect(paginacion).toEqual({ pagina: 1, porPagina: 20, total: 3 });
  });

  it('busca por subcadena del titulo, sin distinguir mayusculas', async () => {
    const { datos } = await listarLibros(ana, { q: 'AÑOS' }, { ejecutar });
    expect(datos.map((l) => l.titulo)).toEqual(['Cien años de soledad']);
  });

  it('busca por subcadena del autor', async () => {
    const { datos } = await listarLibros(ana, { q: 'borges' }, { ejecutar });
    expect(datos.map((l) => l.titulo)).toEqual(['Ficciones']);
  });

  it('q vacio o con espacios = sin filtro', async () => {
    expect((await listarLibros(ana, { q: '   ' }, { ejecutar })).paginacion.total).toBe(3);
  });

  it('pagina y porPagina', async () => {
    const { datos, paginacion } = await listarLibros(ana, { pagina: '2', porPagina: '2' }, { ejecutar });
    expect(datos.map((l) => l.titulo)).toEqual(['Rayuela']);
    expect(paginacion).toEqual({ pagina: 2, porPagina: 2, total: 3 });
  });

  it('valores fuera de rango se recortan, no son error', async () => {
    const { paginacion } = await listarLibros(ana, { pagina: '-3', porPagina: '9999' }, { ejecutar });
    expect(paginacion.pagina).toBe(1);
    expect(paginacion.porPagina).toBe(POR_PAGINA_MAX);
    const otro = await listarLibros(ana, { pagina: 'abc', porPagina: 'x' }, { ejecutar });
    expect(otro.paginacion).toMatchObject({ pagina: 1, porPagina: 20 });
  });

  it('cada libro trae total, reservada y disponible', async () => {
    const { datos } = await listarLibros(ana, { q: 'soledad' }, { ejecutar });
    await reservar(datos[0].id, 2);
    const [libro] = (await listarLibros(ana, { q: 'soledad' }, { ejecutar })).datos;
    expect(libro).toMatchObject({ total: 2, reservada: 2, disponible: 0 });
  });
});
