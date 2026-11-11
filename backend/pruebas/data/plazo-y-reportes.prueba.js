import { describe, it, expect, beforeEach } from 'vitest';

import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
});

describe('migracion 008: parametros, flagueo y reportes', () => {
  it('el plazo de confirmacion arranca en 24 horas', async () => {
    const { rows } = await ejecutar(`SELECT valor FROM parametros WHERE clave = 'plazo_confirmacion_segundos'`);
    expect(rows[0].valor).toBe('86400');
  });

  it('una solicitud nueva no esta flagueada', async () => {
    const ana = (await sembrarUsuario(ejecutar, { email: 'ana@ejemplo.com' })).id;
    const beto = (await sembrarUsuario(ejecutar, { email: 'beto@ejemplo.com' })).id;
    const libro = async (u) =>
      (await ejecutar(`INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 't', 'a', 1) RETURNING id`, [u])).rows[0].id;
    const l1 = await libro(ana);
    const l2 = await libro(beto);
    const p = (await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [l1, ana])).rows[0].id;
    const { rows } = await ejecutar(
      `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id) VALUES ($1, $2, $3) RETURNING *`,
      [p, beto, l2],
    );
    expect(rows[0]).toMatchObject({ flagueada_en: null, motivo_flagueo: null });

    const reporte = await ejecutar(
      `INSERT INTO reportes (solicitud_id, autor_id, descripcion) VALUES ($1, $2, 'No vino') RETURNING *`,
      [rows[0].id, beto],
    );
    expect(reporte.rows[0]).toMatchObject({ descripcion: 'No vino' });
    expect(reporte.rows[0].creado_en).toBeInstanceOf(Date);
  });
});
