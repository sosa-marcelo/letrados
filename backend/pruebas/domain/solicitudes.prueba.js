import { describe, it, expect, beforeEach } from 'vitest';

import { solicitar, vistaSolicitud, puedoCon, parteDe } from '../../src/domain/solicitudes.js';
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
