import { describe, it, expect, beforeEach } from 'vitest';

import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let duenio;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  duenio = (await sembrarUsuario(ejecutar)).id;
});

/** Inserta un libro solo con las columnas del ciclo 2. */
async function insertarLibroBasico() {
  const { rows } = await ejecutar(
    `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total)
     VALUES ($1, 'Rayuela', 'Julio Cortázar', 1) RETURNING *`,
    [duenio],
  );
  return rows[0];
}

describe('migracion 005: datos opcionales del libro', () => {
  it('un libro cargado solo con titulo, autor y cantidad deja los seis datos en null', async () => {
    const libro = await insertarLibroBasico();
    expect(libro).toMatchObject({
      editorial: null,
      anio_publicacion: null,
      edicion: null,
      isbn: null,
      estado_conservacion: null,
      descripcion: null,
    });
  });

  it('guarda los seis datos cuando vienen', async () => {
    const { rows } = await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total,
                           editorial, anio_publicacion, edicion, isbn,
                           estado_conservacion, descripcion)
       VALUES ($1, 'Rayuela', 'Julio Cortázar', 1,
               'Sudamericana', 1963, '1.a edicion', '9789500703134',
               'muy_bueno', 'Tapa dura, sin marcas')
       RETURNING *`,
      [duenio],
    );
    expect(rows[0]).toMatchObject({
      editorial: 'Sudamericana',
      anio_publicacion: 1963,
      edicion: '1.a edicion',
      isbn: '9789500703134',
      estado_conservacion: 'muy_bueno',
      descripcion: 'Tapa dura, sin marcas',
    });
  });

  it('rechaza un estado de conservacion fuera de la lista', async () => {
    const libro = await insertarLibroBasico();
    await expect(
      ejecutar(`UPDATE libros SET estado_conservacion = 'roto' WHERE id = $1`, [libro.id]),
    ).rejects.toThrow();
  });

  it('rechaza un año de publicacion fuera de 1450..2100', async () => {
    const libro = await insertarLibroBasico();
    await expect(
      ejecutar(`UPDATE libros SET anio_publicacion = 1300 WHERE id = $1`, [libro.id]),
    ).rejects.toThrow();
    await expect(
      ejecutar(`UPDATE libros SET anio_publicacion = 2101 WHERE id = $1`, [libro.id]),
    ).rejects.toThrow();
  });
});
