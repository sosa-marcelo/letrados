import { describe, it, expect, beforeEach } from 'vitest';

import {
  publicar,
  modificarNota,
  retirar,
  vistaPublicacion,
  subirFoto,
  quitarFoto,
  verFoto,
  BYTES_MAX_FOTO,
  listarActivas,
  verPublicacion,
  POR_PAGINA_MAX,
} from '../../src/domain/publicaciones.js';
import { agregarLibro, listarLibros, modificarLibro } from '../../src/domain/libros.js';
import { perfilPublico } from '../../src/domain/perfil.js';
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

describe('fotos de la publicacion (LET-127)', () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  it('subirFoto guarda la imagen y verFoto devuelve los mismos bytes', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const conFoto = await subirFoto(ana, p.id, { tipo: 'image/jpeg', bytes: JPEG }, { ejecutar });
    expect(conFoto.tieneFoto).toBe(true);
    const foto = await verFoto(p.id, { ejecutar });
    expect(foto.tipo).toBe('image/jpeg');
    expect(foto.bytes.equals(JPEG)).toBe(true);
  });

  it('subir otra la reemplaza', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await subirFoto(ana, p.id, { tipo: 'image/jpeg', bytes: JPEG }, { ejecutar });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await subirFoto(ana, p.id, { tipo: 'image/png', bytes: png }, { ejecutar });
    const foto = await verFoto(p.id, { ejecutar });
    expect(foto.tipo).toBe('image/png');
    expect(foto.bytes.equals(png)).toBe(true);
  });

  it('quitarFoto la borra y verFoto responde 404', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await subirFoto(ana, p.id, { tipo: 'image/jpeg', bytes: JPEG }, { ejecutar });
    expect((await quitarFoto(ana, p.id, { ejecutar })).tieneFoto).toBe(false);
    expect(await errorDe(() => verFoto(p.id, { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it.each([
    ['image/gif', JPEG],
    ['image/jpeg', Buffer.alloc(0)],
    ['image/jpeg', undefined],
  ])('tipo %s o cuerpo vacio -> 400 en el campo foto', async (tipo, bytes) => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const error = await errorDe(() => subirFoto(ana, p.id, { tipo, bytes }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'DATOS_INVALIDOS', estado: 400 });
    expect(error.detalles[0].campo).toBe('foto');
  });

  it('mas de 2 MB -> 413', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const grande = Buffer.alloc(BYTES_MAX_FOTO + 1);
    expect(await errorDe(() => subirFoto(ana, p.id, { tipo: 'image/png', bytes: grande }, { ejecutar }))).toMatchObject({
      codigo: 'ARCHIVO_DEMASIADO_GRANDE',
      estado: 413,
    });
  });

  it('en una ajena -> 404 y en una reservada -> 409', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    expect(await errorDe(() => subirFoto(beto, p.id, { tipo: 'image/jpeg', bytes: JPEG }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await ejecutar(`UPDATE publicaciones SET estado = 'reservada' WHERE id = $1`, [p.id]);
    expect(await errorDe(() => quitarFoto(ana, p.id, { ejecutar }))).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
  });
});

describe('listarActivas y verPublicacion (LET-128, RF-15 y RF-16)', () => {
  it('sin sesion lista todo lo activo, del mas nuevo al mas viejo, sin esMia', async () => {
    const ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
    const p1 = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const p2 = await publicar(beto, { libroId: ficciones.id }, { ejecutar });
    const { datos, paginacion } = await listarActivas({}, { ejecutar });
    expect(datos.map((p) => p.id)).toEqual([p2.id, p1.id]);
    expect(datos.every((p) => p.esMia === false)).toBe(true);
    expect(datos[0].propietario).toMatchObject({ id: beto, nombre: 'Beto', reputacion: { promedio: null, cantidad: 0 } });
    expect(paginacion).toEqual({ pagina: 1, porPagina: 20, total: 2 });
  });

  it('con sesion, las propias vienen con esMia true', async () => {
    const ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
    await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await publicar(beto, { libroId: ficciones.id }, { ejecutar });
    const { datos } = await listarActivas({}, { usuarioId: ana, ejecutar });
    expect(Object.fromEntries(datos.map((p) => [p.libro.titulo, p.esMia]))).toEqual({
      Rayuela: true,
      Ficciones: false,
    });
  });

  it('deja afuera las cuentas bloqueadas y los libros sin disponibles', async () => {
    const ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
    await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await publicar(beto, { libroId: ficciones.id }, { ejecutar });
    await ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE id = $1`, [beto]);
    await ejecutar('UPDATE libros SET cantidad_reservada = 2 WHERE id = $1', [rayuela.id]);
    expect((await listarActivas({}, { ejecutar })).paginacion.total).toBe(0);
  });

  it('busca por titulo o autor y recorta la paginacion', async () => {
    const ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
    await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await publicar(beto, { libroId: ficciones.id }, { ejecutar });
    expect((await listarActivas({ q: '  borg ' }, { ejecutar })).datos.map((p) => p.libro.titulo)).toEqual(['Ficciones']);
    const { paginacion } = await listarActivas({ pagina: 'x', porPagina: 500 }, { ejecutar });
    expect(paginacion).toMatchObject({ pagina: 1, porPagina: POR_PAGINA_MAX });
  });

  it('el detalle responde en cualquier estado, con esMia segun la sesion', async () => {
    const p = await publicar(ana, { libroId: rayuela.id, nota: 'En el centro' }, { ejecutar });
    await retirar(ana, p.id, { ejecutar });
    const visto = await verPublicacion(p.id, { ejecutar });
    expect(visto).toMatchObject({ id: p.id, estado: 'retirada', nota: 'En el centro', esMia: false });
    expect((await verPublicacion(p.id, { usuarioId: ana, ejecutar })).esMia).toBe(true);
  });

  it('el detalle de una inexistente -> 404', async () => {
    expect(await errorDe(() => verPublicacion('999', { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});

describe('catalogo y perfil publico con publicaciones (LET-130)', () => {
  it('listarLibros marca publicado y publicacionId solo en los libros con publicacion vigente', async () => {
    const ficciones = await agregarLibro(ana, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const { datos } = await listarLibros(ana, {}, { ejecutar });
    const porTitulo = Object.fromEntries(datos.map((l) => [l.titulo, l]));
    expect(porTitulo.Rayuela).toMatchObject({ publicado: true, publicacionId: p.id });
    expect(porTitulo.Ficciones).toMatchObject({ publicado: false, publicacionId: null });
    expect(ficciones.publicado).toBe(false);
  });

  it('una publicacion retirada ya no cuenta como publicado', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await retirar(ana, p.id, { ejecutar });
    const [libro] = (await listarLibros(ana, {}, { ejecutar })).datos;
    expect(libro.publicado).toBe(false);
  });

  it('modificarLibro sigue diciendo que el libro esta publicado', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    const libro = await modificarLibro(ana, rayuela.id, { titulo: 'Rayuela', autor: 'Cortázar', cantidad: 3 }, { ejecutar });
    expect(libro).toMatchObject({ publicado: true, publicacionId: p.id, total: 3 });
  });

  it('el perfil publico lista las publicaciones activas con la forma de Explorar', async () => {
    const p = await publicar(ana, { libroId: rayuela.id, nota: 'En el centro' }, { ejecutar });
    const perfil = await perfilPublico(ana, { ejecutar });
    expect(perfil.publicaciones).toHaveLength(1);
    expect(perfil.publicaciones[0]).toMatchObject({
      id: p.id,
      nota: 'En el centro',
      esMia: false,
      libro: { titulo: 'Rayuela' },
      propietario: { id: ana, nombre: 'Ana' },
    });
  });

  it('el perfil publico no muestra retiradas ni las de una cuenta bloqueada', async () => {
    const p = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
    await ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE id = $1`, [ana]);
    expect((await perfilPublico(ana, { ejecutar })).publicaciones).toEqual([]);
    await ejecutar(`UPDATE usuarios SET estado = 'activa' WHERE id = $1`, [ana]);
    await retirar(ana, p.id, { ejecutar });
    expect((await perfilPublico(ana, { ejecutar })).publicaciones).toEqual([]);
  });
});
