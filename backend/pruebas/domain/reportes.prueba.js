import { describe, it, expect, beforeEach } from 'vitest';

import { reportar } from '../../src/domain/reportes.js';
import { solicitar, aceptar, ver } from '../../src/domain/solicitudes.js';
import { publicar } from '../../src/domain/publicaciones.js';
import { agregarLibro } from '../../src/domain/libros.js';
import { reportesDeSolicitudes } from '../../src/data/reportes.js';
import { listarFlagueados } from '../../src/domain/admin.js';
import { confirmar } from '../../src/domain/solicitudes.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
let solicitud;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  ana = String((await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id);
  beto = String((await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id);
  const rayuela = await agregarLibro(ana, { titulo: 'Rayuela', autor: 'Cortázar', cantidad: 1 }, { ejecutar });
  const ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
  const publicacion = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
  solicitud = await solicitar(beto, { publicacionId: publicacion.id, libroOfrecidoId: ficciones.id }, { ejecutar });
});

async function errorDe(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('se esperaba un error');
}

async function flagueada() {
  await aceptar(ana, solicitud.id, { ejecutar });
  await ejecutar(`UPDATE solicitudes SET vence_en = now() - interval '1 second' WHERE id = $1`, [solicitud.id]);
}

describe('reportes de inconvenientes (LET-156, RF-24)', () => {
  it('una parte reporta sobre una flagueada; las dos pueden, y mas de una vez', async () => {
    await flagueada();
    const reporte = await reportar(beto, solicitud.id, { descripcion: 'No vino al encuentro' }, { ejecutar });
    expect(reporte).toMatchObject({ autor: { id: beto, nombre: 'Beto' }, descripcion: 'No vino al encuentro' });
    await reportar(ana, solicitud.id, { descripcion: 'Me avisó tarde' }, { ejecutar });
    await reportar(beto, solicitud.id, { descripcion: 'Sigo esperando' }, { ejecutar });
    const filas = await reportesDeSolicitudes([solicitud.id], ejecutar);
    expect(filas.map((f) => f.descripcion)).toEqual(['No vino al encuentro', 'Me avisó tarde', 'Sigo esperando']);
  });

  it('puedo.reportar solo en una flagueada', async () => {
    expect((await ver(beto, solicitud.id, { ejecutar })).puedo.reportar).toBe(false);
    await flagueada();
    expect((await ver(beto, solicitud.id, { ejecutar })).puedo.reportar).toBe(true);
  });

  it('sobre una aceptada en plazo -> 409', async () => {
    await aceptar(ana, solicitud.id, { ejecutar });
    const error = await errorDe(() => reportar(beto, solicitud.id, { descripcion: 'x' }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
  });

  it('un tercero -> 404', async () => {
    await flagueada();
    const carla = String((await sembrarUsuario(ejecutar, { email: 'carla@ejemplo.com' })).id);
    expect(await errorDe(() => reportar(carla, solicitud.id, { descripcion: 'x' }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('reportesDeSolicitudes sin ids devuelve []', async () => {
    expect(await reportesDeSolicitudes([], ejecutar)).toEqual([]);
  });
});

describe('listarFlagueados para el panel (LET-157, RF-23 y RF-24)', () => {
  it('trae el flagueado con las dos partes, los libros, el motivo y sus reportes', async () => {
    await flagueada();
    await reportar(beto, solicitud.id, { descripcion: 'No vino' }, { ejecutar });
    const { datos, paginacion } = await listarFlagueados({}, { ejecutar });
    expect(paginacion.total).toBe(1);
    expect(datos[0]).toMatchObject({
      id: solicitud.id,
      estado: 'flagueada',
      propietario: { id: ana, nombre: 'Ana' },
      solicitante: { id: beto, nombre: 'Beto' },
      libroSolicitado: { titulo: 'Rayuela' },
      libroOfrecido: { titulo: 'Ficciones' },
      reportes: [{ descripcion: 'No vino', autor: { nombre: 'Beto' } }],
    });
    expect(datos[0].motivo).toMatch(/Venció el plazo/);
  });

  it('barre antes de listar: lo que vencio recien ya aparece', async () => {
    await aceptar(ana, solicitud.id, { ejecutar });
    await ejecutar(`UPDATE solicitudes SET vence_en = now() - interval '1 second' WHERE id = $1`, [solicitud.id]);
    expect((await listarFlagueados({}, { ejecutar })).paginacion.total).toBe(1);
  });

  it('por defecto, solo los que siguen flagueados; con todos, tambien los que se completaron', async () => {
    await flagueada();
    await confirmar(ana, solicitud.id, { ejecutar });
    await confirmar(beto, solicitud.id, { ejecutar });
    expect((await listarFlagueados({}, { ejecutar })).paginacion.total).toBe(0);
    const todos = await listarFlagueados({ estado: 'todos' }, { ejecutar });
    expect(todos.datos.map((d) => d.estado)).toEqual(['completada']);
  });
});
