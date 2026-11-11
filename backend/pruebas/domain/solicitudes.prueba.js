import { describe, it, expect, beforeEach } from 'vitest';

import {
  solicitar,
  vistaSolicitud,
  puedoCon,
  parteDe,
  aceptar,
  rechazar,
} from '../../src/domain/solicitudes.js';
import { publicar } from '../../src/domain/publicaciones.js';
import { agregarLibro } from '../../src/domain/libros.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let ana;
let beto;
let rayuela;
let ficciones;
let publicacion;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  ana = String((await sembrarUsuario(ejecutar, { nombre: 'Ana', email: 'ana@ejemplo.com' })).id);
  beto = String((await sembrarUsuario(ejecutar, { nombre: 'Beto', email: 'beto@ejemplo.com' })).id);
  rayuela = await agregarLibro(ana, { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 1 }, { ejecutar });
  ficciones = await agregarLibro(beto, { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 }, { ejecutar });
  publicacion = await publicar(ana, { libroId: rayuela.id }, { ejecutar });
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

const pedir = (usuario = beto, libroOfrecidoId = ficciones.id, publicacionId = publicacion.id) =>
  solicitar(usuario, { publicacionId, libroOfrecidoId }, { ejecutar });

describe('solicitar (RF-17)', () => {
  it('crea la solicitud pendiente, vista por quien la envia', async () => {
    const s = await pedir();
    expect(s).toMatchObject({
      estado: 'pendiente',
      soyPropietario: false,
      publicacionId: publicacion.id,
      contraparte: { id: ana, nombre: 'Ana' },
      libroSolicitado: { id: rayuela.id, titulo: 'Rayuela' },
      libroOfrecido: { id: ficciones.id, titulo: 'Ficciones' },
      venceEn: null,
      confirmadaPorMi: false,
      puedo: { aceptar: false, rechazar: false, cancelar: true, confirmar: false },
    });
  });

  it('no reserva nada', async () => {
    await pedir();
    const { rows } = await ejecutar('SELECT cantidad_reservada FROM libros ORDER BY id');
    expect(rows.map((r) => r.cantidad_reservada)).toEqual([0, 0]);
  });

  it('la propia publicacion -> 409', async () => {
    const otro = await agregarLibro(ana, { titulo: 'Otro', autor: 'X', cantidad: 1 }, { ejecutar });
    const error = await errorDe(() => pedir(ana, otro.id));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toMatch(/tu propia publicación/);
  });

  it('una publicacion inexistente -> 404', async () => {
    expect(await errorDe(() => pedir(beto, ficciones.id, '999'))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it.each([
    ['retirada', `UPDATE publicaciones SET estado = 'retirada'`],
    ['de una cuenta bloqueada', `UPDATE usuarios SET estado = 'bloqueada' WHERE email = 'ana@ejemplo.com'`],
    ['sin ejemplares', `UPDATE libros SET cantidad_reservada = 1 WHERE titulo = 'Rayuela'`],
  ])('una publicacion %s -> 409 «ya no está disponible»', async (_caso, sql) => {
    await ejecutar(sql);
    const error = await errorDe(() => pedir());
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    expect(error.message).toMatch(/ya no está disponible/);
  });

  it('ofrecer un libro ajeno o archivado -> 409 en libroOfrecidoId', async () => {
    const ajeno = await errorDe(() => pedir(beto, rayuela.id));
    expect(ajeno).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    expect(ajeno.detalles[0].campo).toBe('libroOfrecidoId');
    await ejecutar('UPDATE libros SET archivado_en = now() WHERE id = $1', [ficciones.id]);
    expect(await errorDe(() => pedir())).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
  });

  it('ofrecer un libro sin disponibles -> 409', async () => {
    await ejecutar('UPDATE libros SET cantidad_reservada = 1 WHERE id = $1', [ficciones.id]);
    const error = await errorDe(() => pedir());
    expect(error.message).toMatch(/no tiene ejemplares disponibles/);
  });

  it('repetir una pendiente -> 409; el mismo libro puede ofrecerse en otra publicacion', async () => {
    await pedir();
    const error = await errorDe(() => pedir());
    expect(error.message).toMatch(/Ya tenés una solicitud pendiente/);

    const carla = String((await sembrarUsuario(ejecutar, { nombre: 'Carla', email: 'carla@ejemplo.com' })).id);
    const aleph = await agregarLibro(carla, { titulo: 'El Aleph', autor: 'Borges', cantidad: 1 }, { ejecutar });
    const otra = await publicar(carla, { libroId: aleph.id }, { ejecutar });
    await expect(pedir(beto, ficciones.id, otra.id)).resolves.toMatchObject({ estado: 'pendiente' });
  });
});

describe('vistaSolicitud y puedoCon', () => {
  const fila = {
    id: 1,
    estado: 'pendiente',
    publicacion_id: 2,
    propietario_id: 10,
    solicitante_id: 20,
    propietario_nombre: 'Ana',
    solicitante_nombre: 'Beto',
    libro_solicitado_id: 3,
    solicitado_titulo: 'Rayuela',
    solicitado_autor: 'Cortázar',
    libro_ofrecido_id: 4,
    ofrecido_titulo: 'Ficciones',
    ofrecido_autor: 'Borges',
    vence_en: null,
    confirmada_propietario_en: null,
    confirmada_solicitante_en: null,
    creada_en: new Date(),
  };

  it('el dueño ve al solicitante como contraparte y puede aceptar o rechazar', () => {
    const vista = vistaSolicitud(fila, '10');
    expect(vista).toMatchObject({ soyPropietario: true, contraparte: { id: '20', nombre: 'Beto' } });
    expect(vista.puedo).toMatchObject({ aceptar: true, rechazar: true, cancelar: true, confirmar: false });
  });

  it('en una aceptada, cada parte confirma una sola vez', () => {
    const aceptada = { ...fila, estado: 'aceptada', vence_en: new Date(), confirmada_propietario_en: new Date() };
    expect(puedoCon(aceptada, '10').confirmar).toBe(false);
    expect(puedoCon(aceptada, '20').confirmar).toBe(true);
    expect(vistaSolicitud(aceptada, '20')).toMatchObject({ confirmadaPorMi: false, confirmadaPorContraparte: true });
  });

  it('en una completada nadie puede nada; un tercero no es parte', () => {
    const completada = { ...fila, estado: 'completada' };
    expect(Object.values(puedoCon(completada, '10')).some(Boolean)).toBe(false);
    expect(parteDe(fila, '99')).toBeNull();
    expect(Object.values(puedoCon(fila, '99')).some(Boolean)).toBe(false);
  });
});

/** Estado de un libro por titulo. */
async function libro(titulo) {
  const { rows } = await ejecutar('SELECT cantidad_total, cantidad_reservada FROM libros WHERE titulo = $1', [titulo]);
  return rows[0];
}

async function estadoPublicacion(id) {
  return (await ejecutar('SELECT estado FROM publicaciones WHERE id = $1', [id])).rows[0].estado;
}

describe('aceptar y rechazar (RF-19, RF-22)', () => {
  it('aceptar reserva 1 + 1, deja la publicacion reservada y fija el plazo de 24 h', async () => {
    const s = await pedir();
    const ahora = new Date('2026-11-12T10:00:00Z');
    const aceptada = await aceptar(ana, s.id, { ejecutar, ahora });
    expect(aceptada).toMatchObject({ estado: 'aceptada', soyPropietario: true, venceEn: '2026-11-13T10:00:00.000Z' });
    expect(aceptada.puedo).toMatchObject({ aceptar: false, cancelar: true, confirmar: true });
    expect(await libro('Rayuela')).toMatchObject({ cantidad_total: 1, cantidad_reservada: 1 });
    expect(await libro('Ficciones')).toMatchObject({ cantidad_total: 1, cantidad_reservada: 1 });
    expect(await estadoPublicacion(publicacion.id)).toBe('reservada');
  });

  it('aceptar rechaza las demas pendientes sobre la publicacion', async () => {
    const carla = String((await sembrarUsuario(ejecutar, { nombre: 'Carla', email: 'carla@ejemplo.com' })).id);
    const aleph = await agregarLibro(carla, { titulo: 'El Aleph', autor: 'Borges', cantidad: 1 }, { ejecutar });
    const deBeto = await pedir();
    const deCarla = await pedir(carla, aleph.id);
    await aceptar(ana, deBeto.id, { ejecutar });
    const { rows } = await ejecutar('SELECT estado FROM solicitudes WHERE id = $1', [deCarla.id]);
    expect(rows[0].estado).toBe('rechazada');
    expect(await libro('El Aleph')).toMatchObject({ cantidad_reservada: 0 });
  });

  it('si el libro ofrecido se quedo sin disponibles -> 409 nombrandolo y nada cambia (CU-22 A2)', async () => {
    const s = await pedir();
    await ejecutar(`UPDATE libros SET cantidad_reservada = 1 WHERE titulo = 'Ficciones'`);
    const error = await errorDe(() => aceptar(ana, s.id, { ejecutar }));
    expect(error).toMatchObject({ codigo: 'ESTADO_INVALIDO', estado: 409 });
    expect(error.message).toMatch(/«Ficciones» ya no tiene ejemplares/);
    expect(await libro('Rayuela')).toMatchObject({ cantidad_reservada: 0 });
    expect(await estadoPublicacion(publicacion.id)).toBe('activa');
    const { rows } = await ejecutar('SELECT estado FROM solicitudes WHERE id = $1', [s.id]);
    expect(rows[0].estado).toBe('pendiente');
  });

  it('si al dueño no le quedan ejemplares -> 409 nombrando su libro', async () => {
    const s = await pedir();
    await ejecutar(`UPDATE libros SET cantidad_reservada = 1 WHERE titulo = 'Rayuela'`);
    expect((await errorDe(() => aceptar(ana, s.id, { ejecutar }))).message).toMatch(/ejemplares disponibles de «Rayuela»/);
  });

  it('solo el dueño acepta o rechaza: el solicitante -> 403, un tercero -> 404', async () => {
    const s = await pedir();
    expect(await errorDe(() => aceptar(beto, s.id, { ejecutar }))).toMatchObject({ codigo: 'ACCESO_DENEGADO', estado: 403 });
    expect(await errorDe(() => rechazar(beto, s.id, { ejecutar }))).toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    const carla = String((await sembrarUsuario(ejecutar, { email: 'carla@ejemplo.com' })).id);
    expect(await errorDe(() => aceptar(carla, s.id, { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(await errorDe(() => aceptar(ana, '999', { ejecutar }))).toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('aceptar una no pendiente -> 409', async () => {
    const s = await pedir();
    await aceptar(ana, s.id, { ejecutar });
    expect(await errorDe(() => aceptar(ana, s.id, { ejecutar }))).toMatchObject({ codigo: 'ESTADO_INVALIDO' });
  });

  it('rechazar deja la publicacion disponible y no reserva nada', async () => {
    const s = await pedir();
    const rechazada = await rechazar(ana, s.id, { ejecutar });
    expect(rechazada).toMatchObject({ estado: 'rechazada' });
    expect(Object.values(rechazada.puedo).some(Boolean)).toBe(false);
    expect(await estadoPublicacion(publicacion.id)).toBe('activa');
    expect(await libro('Ficciones')).toMatchObject({ cantidad_reservada: 0 });
  });
});
