import { describe, it, expect, beforeEach } from 'vitest';

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
