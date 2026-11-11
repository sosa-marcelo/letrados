import { describe, it, expect, beforeEach } from 'vitest';

import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
let publicacion;
let libroDeBeto;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  ana = (await sembrarUsuario(ejecutar, { email: 'ana@ejemplo.com' })).id;
  beto = (await sembrarUsuario(ejecutar, { email: 'beto@ejemplo.com' })).id;
  const libroDeAna = (
    await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 'Rayuela', 'Cortázar', 1) RETURNING id`,
      [ana],
    )
  ).rows[0];
  libroDeBeto = (
    await ejecutar(
      `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 'Ficciones', 'Borges', 1) RETURNING id`,
      [beto],
    )
  ).rows[0];
  publicacion = (
    await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [
      libroDeAna.id,
      ana,
    ])
  ).rows[0];
});

async function solicitar(estado = 'pendiente', extra = {}) {
  const { rows } = await ejecutar(
    `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id, estado, vence_en)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [publicacion.id, beto, libroDeBeto.id, estado, extra.vence_en ?? null],
  );
  return rows[0];
}

describe('migracion 007: solicitudes', () => {
  it('una solicitud nace pendiente, sin confirmaciones ni plazo', async () => {
    const s = await solicitar();
    expect(s).toMatchObject({
      estado: 'pendiente',
      vence_en: null,
      confirmada_propietario_en: null,
      confirmada_solicitante_en: null,
      cancelada_por: null,
    });
  });

  it('rechaza un estado fuera de la lista', async () => {
    await expect(solicitar('pausada')).rejects.toThrow();
  });

  it('una aceptada sin plazo de confirmacion no entra', async () => {
    await expect(solicitar('aceptada')).rejects.toThrow();
    await expect(solicitar('aceptada', { vence_en: new Date() })).resolves.toMatchObject({ estado: 'aceptada' });
  });

  it('una sola pendiente por persona y publicacion; las cerradas no cuentan', async () => {
    await solicitar('pendiente');
    await expect(solicitar('pendiente')).rejects.toThrow();
    await ejecutar(`UPDATE solicitudes SET estado = 'cancelada'`);
    await expect(solicitar('pendiente')).resolves.toMatchObject({ estado: 'pendiente' });
  });
});
