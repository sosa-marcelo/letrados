import { describe, it, expect, beforeEach } from 'vitest';

import {
  insertarPublicacion,
  bloquearPublicacionPropia,
  publicacionVigenteDeLibro,
  publicacionesVigentesDeLibros,
  actualizarNota,
  cambiarEstadoPublicacion,
  buscarPublicacion,
  listarPublicacionesActivas,
  publicacionesActivasDeUsuario,
} from '../../src/data/publicaciones.js';
import { guardarFoto } from '../../src/data/fotos.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let duenio;
let libro;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  duenio = (await sembrarUsuario(ejecutar)).id;
  libro = (
    await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total)
       VALUES ($1, 'Rayuela', 'Julio Cortázar', 2) RETURNING *`,
      [duenio],
    )
  ).rows[0];
});

async function publicar(estado = 'activa') {
  const { rows } = await ejecutar(
    `INSERT INTO publicaciones (libro_id, usuario_id, estado) VALUES ($1, $2, $3) RETURNING *`,
    [libro.id, duenio, estado],
  );
  return rows[0];
}

describe('migracion 006: publicaciones y fotos', () => {
  it('una publicacion nace activa, sin nota y con fecha', async () => {
    const p = await publicar();
    expect(p).toMatchObject({ estado: 'activa', nota: null, cerrada_en: null });
    expect(p.creada_en).toBeInstanceOf(Date);
  });

  it('rechaza un estado fuera de la lista', async () => {
    await expect(publicar('pausada')).rejects.toThrow();
  });

  it('un libro no puede tener dos publicaciones vigentes', async () => {
    await publicar('activa');
    await expect(publicar('activa')).rejects.toThrow();
    await expect(publicar('reservada')).rejects.toThrow();
  });

  it('cerradas y retiradas no cuentan como vigentes', async () => {
    await publicar('cerrada');
    await publicar('retirada');
    await expect(publicar('activa')).resolves.toMatchObject({ estado: 'activa' });
  });

  it('guarda y devuelve los bytes de una foto, en base64', async () => {
    const p = await publicar();
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await ejecutar(
      `INSERT INTO fotos_publicacion (publicacion_id, tipo, contenido) VALUES ($1, 'image/jpeg', $2)`,
      [p.id, bytes.toString('base64')],
    );
    const { rows } = await ejecutar(
      `SELECT tipo, contenido FROM fotos_publicacion WHERE publicacion_id = $1`,
      [p.id],
    );
    expect(rows[0].tipo).toBe('image/jpeg');
    expect(Buffer.from(rows[0].contenido, 'base64').equals(bytes)).toBe(true);
  });

  it('rechaza una foto de un tipo no admitido', async () => {
    const p = await publicar();
    await expect(
      ejecutar(
        `INSERT INTO fotos_publicacion (publicacion_id, tipo, contenido) VALUES ($1, 'image/gif', 'AQ==')`,
        [p.id],
      ),
    ).rejects.toThrow();
  });
});

describe('capa de datos de publicaciones (LET-125)', () => {
  /** Inserta un libro del dueño indicado. */
  async function libroDe(usuario, { titulo = 'Ficciones', autor = 'Borges', total = 1, reservada = 0 } = {}) {
    const { rows } = await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total, cantidad_reservada)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [usuario, titulo, autor, total, reservada],
    );
    return rows[0];
  }

  it('insertarPublicacion la crea activa con su nota', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio, nota: 'En el centro' }, ejecutar);
    expect(p).toMatchObject({ estado: 'activa', nota: 'En el centro' });
    expect(String(p.libro_id)).toBe(String(libro.id));
  });

  it('bloquearPublicacionPropia devuelve null si es de otra persona', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    const otra = (await sembrarUsuario(ejecutar, { email: 'otra@ejemplo.com' })).id;
    expect(await bloquearPublicacionPropia(p.id, duenio, ejecutar)).toMatchObject({ id: p.id });
    expect(await bloquearPublicacionPropia(p.id, otra, ejecutar)).toBeNull();
  });

  it('publicacionVigenteDeLibro ignora cerradas y retiradas', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    expect(await publicacionVigenteDeLibro(libro.id, ejecutar)).toMatchObject({ id: p.id });
    await cambiarEstadoPublicacion(p.id, 'retirada', ejecutar);
    expect(await publicacionVigenteDeLibro(libro.id, ejecutar)).toBeNull();
  });

  it('publicacionesVigentesDeLibros trae las de varios libros en una consulta', async () => {
    const otro = await libroDe(duenio);
    const p1 = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    const p2 = await insertarPublicacion({ libro_id: otro.id, usuario_id: duenio }, ejecutar);
    const filas = await publicacionesVigentesDeLibros([libro.id, otro.id], ejecutar);
    expect(filas.map((f) => f.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(await publicacionesVigentesDeLibros([], ejecutar)).toEqual([]);
  });

  it('actualizarNota reemplaza la nota, tambien por null', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio, nota: 'a' }, ejecutar);
    expect((await actualizarNota(p.id, 'b', ejecutar)).nota).toBe('b');
    expect((await actualizarNota(p.id, null, ejecutar)).nota).toBeNull();
  });

  it('cambiarEstadoPublicacion sella cerrada_en al terminar y lo limpia al volver', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    expect((await cambiarEstadoPublicacion(p.id, 'reservada', ejecutar)).cerrada_en).toBeNull();
    expect((await cambiarEstadoPublicacion(p.id, 'cerrada', ejecutar)).cerrada_en).toBeInstanceOf(Date);
    expect((await cambiarEstadoPublicacion(p.id, 'activa', ejecutar)).cerrada_en).toBeNull();
  });

  it('buscarPublicacion trae libro, dueño y si tiene foto, en cualquier estado', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    await cambiarEstadoPublicacion(p.id, 'retirada', ejecutar);
    const fila = await buscarPublicacion(p.id, ejecutar);
    expect(fila).toMatchObject({
      id: p.id,
      estado: 'retirada',
      titulo: 'Rayuela',
      autor: 'Julio Cortázar',
      propietario_nombre: 'Persona',
      tiene_foto: false,
    });
    await guardarFoto(p.id, { tipo: 'image/png', contenido: 'AQID' }, ejecutar);
    expect((await buscarPublicacion(p.id, ejecutar)).tiene_foto).toBe(true);
    expect(await buscarPublicacion(999, ejecutar)).toBeNull();
  });

  describe('listarPublicacionesActivas (RF-15)', () => {
    it('solo activas, de libros con disponibles y cuentas activas, de la mas nueva a la mas vieja', async () => {
      const otra = (await sembrarUsuario(ejecutar, { email: 'otra@ejemplo.com' })).id;
      const bloqueada = (await sembrarUsuario(ejecutar, { email: 'bloq@ejemplo.com' })).id;
      await ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE id = $1`, [bloqueada]);

      const visible1 = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
      const visible2 = await insertarPublicacion(
        { libro_id: (await libroDe(otra, { titulo: 'El Aleph' })).id, usuario_id: otra },
        ejecutar,
      );
      const sinDisponibles = await libroDe(otra, { total: 1, reservada: 1 });
      await insertarPublicacion({ libro_id: sinDisponibles.id, usuario_id: otra }, ejecutar);
      await insertarPublicacion({ libro_id: (await libroDe(bloqueada)).id, usuario_id: bloqueada }, ejecutar);
      const retirada = await insertarPublicacion(
        { libro_id: (await libroDe(otra)).id, usuario_id: otra },
        ejecutar,
      );
      await cambiarEstadoPublicacion(retirada.id, 'retirada', ejecutar);

      const { filas, total } = await listarPublicacionesActivas({ limite: 20, desplazamiento: 0 }, ejecutar);
      expect(total).toBe(2);
      expect(filas.map((f) => f.id)).toEqual([visible2.id, visible1.id]);
    });

    it('busca por subcadena del titulo o del autor y pagina', async () => {
      await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
      await insertarPublicacion({ libro_id: (await libroDe(duenio, { titulo: 'El Aleph', autor: 'Jorge Luis Borges' })).id, usuario_id: duenio }, ejecutar);
      expect((await listarPublicacionesActivas({ q: 'rayu', limite: 20, desplazamiento: 0 }, ejecutar)).total).toBe(1);
      expect((await listarPublicacionesActivas({ q: 'BORGES', limite: 20, desplazamiento: 0 }, ejecutar)).total).toBe(1);
      const pagina2 = await listarPublicacionesActivas({ limite: 1, desplazamiento: 1 }, ejecutar);
      expect(pagina2).toMatchObject({ total: 2 });
      expect(pagina2.filas).toHaveLength(1);
    });
  });

  it('publicacionesActivasDeUsuario usa el mismo filtro que Explorar', async () => {
    const p = await insertarPublicacion({ libro_id: libro.id, usuario_id: duenio }, ejecutar);
    const otra = await insertarPublicacion({ libro_id: (await libroDe(duenio)).id, usuario_id: duenio }, ejecutar);
    await cambiarEstadoPublicacion(otra.id, 'reservada', ejecutar);
    const filas = await publicacionesActivasDeUsuario(duenio, ejecutar);
    expect(filas.map((f) => f.id)).toEqual([p.id]);
  });
});
