import { describe, it, expect, beforeEach } from 'vitest';

import { valorar } from '../../src/domain/valoraciones.js';
import { solicitar, aceptar, confirmar, ver } from '../../src/domain/solicitudes.js';
import { publicar } from '../../src/domain/publicaciones.js';
import { agregarLibro } from '../../src/domain/libros.js';
import { validarValoracion } from '../../src/api/validacion.js';
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

async function completada() {
  await aceptar(ana, solicitud.id, { ejecutar });
  await confirmar(ana, solicitud.id, { ejecutar });
  await confirmar(beto, solicitud.id, { ejecutar });
}

describe('valorar a la contraparte (LET-163, RF-25)', () => {
  it('una parte de un intercambio completado valora a la otra', async () => {
    await completada();
    const valoracion = await valorar(beto, solicitud.id, { puntaje: 5, comentario: 'Muy puntual' }, { ejecutar });
    expect(valoracion).toMatchObject({ puntaje: 5, comentario: 'Muy puntual' });
    const { rows } = await ejecutar('SELECT autor_id, valorado_id FROM valoraciones');
    expect(String(rows[0].autor_id)).toBe(beto);
    expect(String(rows[0].valorado_id)).toBe(ana);
  });

  it('puedo.valorar se apaga despues de valorar y miValoracion guarda el puntaje', async () => {
    await completada();
    expect((await ver(ana, solicitud.id, { ejecutar })).puedo.valorar).toBe(true);
    await valorar(ana, solicitud.id, { puntaje: 4 }, { ejecutar });
    const vista = await ver(ana, solicitud.id, { ejecutar });
    expect(vista).toMatchObject({ miValoracion: 4, puedo: { valorar: false } });
    expect((await ver(beto, solicitud.id, { ejecutar })).puedo.valorar).toBe(true);
  });

  it('repetir -> 409 «Ya valoraste este intercambio»', async () => {
    await completada();
    await valorar(beto, solicitud.id, { puntaje: 5 }, { ejecutar });
    const error = await errorDe(() => valorar(beto, solicitud.id, { puntaje: 3 }, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toBe('Ya valoraste este intercambio');
  });

  it('una aceptada -> 409; un tercero -> 404', async () => {
    await aceptar(ana, solicitud.id, { ejecutar });
    expect(await errorDe(() => valorar(beto, solicitud.id, { puntaje: 5 }, { ejecutar }))).toMatchObject({
      codigo: 'ESTADO_INVALIDO',
    });
    const carla = String((await sembrarUsuario(ejecutar, { email: 'carla@ejemplo.com' })).id);
    expect(await errorDe(() => valorar(carla, solicitud.id, { puntaje: 5 }, { ejecutar }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });
});

describe('validarValoracion', () => {
  it('acepta 1 a 5 como numero o texto y recorta el comentario', () => {
    expect(validarValoracion({ puntaje: '4', comentario: '  bien ' })).toEqual({ puntaje: 4, comentario: 'bien' });
    expect(validarValoracion({ puntaje: 1 })).toEqual({ puntaje: 1, comentario: null });
  });

  it.each([0, 6, 2.5, 'cinco', undefined])('puntaje %j -> 400 en el campo puntaje', (puntaje) => {
    try {
      validarValoracion({ puntaje });
      throw new Error('deberia fallar');
    } catch (error) {
      expect(error.detalles.map((d) => d.campo)).toEqual(['puntaje']);
    }
  });

  it('comentario de mas de 500 -> 400 en comentario', () => {
    expect(() => validarValoracion({ puntaje: 5, comentario: 'c'.repeat(501) })).toThrow();
  });
});
