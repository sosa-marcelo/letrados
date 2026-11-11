import { describe, it, expect, beforeEach } from 'vitest';

import { leerParametro } from '../../src/data/parametros.js';
import { flaguearVencidas, listarFlagueadas } from '../../src/data/solicitudes.js';
import { insertarReporte, reportesDeSolicitudes } from '../../src/data/reportes.js';
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

describe('datos de plazo, flagueo y reportes (LET-158)', () => {
  /** Siembra una solicitud aceptada; `vencida` la deja con el plazo pasado. */
  async function aceptada({ vencida = false, email = 'ana@ejemplo.com' } = {}) {
    const ana = (await sembrarUsuario(ejecutar, { email })).id;
    const beto = (await sembrarUsuario(ejecutar, { email: `b-${email}` })).id;
    const libro = async (u) =>
      (await ejecutar(`INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 't', 'a', 1) RETURNING id`, [u])).rows[0].id;
    const p = (await ejecutar(`INSERT INTO publicaciones (libro_id, usuario_id) VALUES ($1, $2) RETURNING id`, [await libro(ana), ana])).rows[0].id;
    const vence = vencida ? "now() - interval '1 second'" : "now() + interval '1 hour'";
    const { rows } = await ejecutar(
      `INSERT INTO solicitudes (publicacion_id, solicitante_id, libro_ofrecido_id, estado, vence_en)
       VALUES ($1, $2, $3, 'aceptada', ${vence}) RETURNING id`,
      [p, beto, await libro(beto)],
    );
    return { id: rows[0].id, beto };
  }

  it('leerParametro devuelve el valor o null', async () => {
    expect(await leerParametro('plazo_confirmacion_segundos', ejecutar)).toBe('86400');
    expect(await leerParametro('no_existe', ejecutar)).toBeNull();
  });

  it('flaguearVencidas solo toca las aceptadas vencidas y pone fecha y motivo', async () => {
    const vencida = await aceptada({ vencida: true });
    const enPlazo = await aceptada({ email: 'otra@ejemplo.com' });
    expect(await flaguearVencidas('Motivo', ejecutar)).toBe(1);
    const { rows } = await ejecutar('SELECT id, estado, motivo_flagueo, flagueada_en FROM solicitudes ORDER BY id');
    expect(rows.find((r) => String(r.id) === String(vencida.id))).toMatchObject({ estado: 'flagueada', motivo_flagueo: 'Motivo' });
    expect(rows.find((r) => String(r.id) === String(enPlazo.id))).toMatchObject({ estado: 'aceptada', flagueada_en: null });
  });

  it('listarFlagueadas filtra, ordena y pagina', async () => {
    const a = await aceptada({ vencida: true });
    await aceptada({ vencida: true, email: 'dos@ejemplo.com' });
    await flaguearVencidas('Motivo', ejecutar);
    await ejecutar(`UPDATE solicitudes SET estado = 'cancelada' WHERE id = $1`, [a.id]);
    expect((await listarFlagueadas({ soloFlagueadas: true, limite: 10, desplazamiento: 0 }, ejecutar)).total).toBe(1);
    const todas = await listarFlagueadas({ soloFlagueadas: false, limite: 1, desplazamiento: 0 }, ejecutar);
    expect(todas.total).toBe(2);
    expect(todas.filas).toHaveLength(1);
  });

  it('insertarReporte devuelve el reporte con el nombre de quien lo hizo', async () => {
    const { id, beto } = await aceptada({ vencida: true });
    const reporte = await insertarReporte({ solicitud_id: id, autor_id: beto, descripcion: 'No vino' }, ejecutar);
    expect(reporte).toMatchObject({ descripcion: 'No vino', autor_nombre: 'Persona' });
    expect((await reportesDeSolicitudes([id], ejecutar)).map((r) => r.descripcion)).toEqual(['No vino']);
  });
});
