import { describe, it, expect, beforeEach } from 'vitest';

import {
  insertarSolicitud,
  bloquearSolicitud,
  buscarSolicitud,
  tienePendiente,
  listarSolicitudesDe,
  solicitudesAbiertasDeUsuario,
  marcarAceptada,
  cerrarSolicitud,
  cerrarPendientesDePublicacion,
  marcarConfirmacion,
} from '../../src/data/solicitudes.js';
import { bloquearLibro, moverEjemplar } from '../../src/data/libros.js';
import { bloquearPublicacion } from '../../src/data/publicaciones.js';
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

describe('capa de datos de solicitudes (LET-138)', () => {
  const base = () => ({ publicacion_id: publicacion.id, solicitante_id: beto, libro_ofrecido_id: libroDeBeto.id });

  it('insertarSolicitud y buscarSolicitud traen la publicacion, los dos libros y las dos partes', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    const fila = await buscarSolicitud(s.id, ejecutar);
    expect(fila).toMatchObject({
      estado: 'pendiente',
      solicitado_titulo: 'Rayuela',
      ofrecido_titulo: 'Ficciones',
      publicacion_estado: 'activa',
    });
    expect(String(fila.propietario_id)).toBe(String(ana));
    expect(String(fila.solicitante_id)).toBe(String(beto));
    expect(await buscarSolicitud(999, ejecutar)).toBeNull();
  });

  it('bloquearSolicitud devuelve la fila o null', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    expect(await bloquearSolicitud(s.id, ejecutar)).toMatchObject({ id: s.id });
    expect(await bloquearSolicitud(999, ejecutar)).toBeNull();
  });

  it('tienePendiente solo cuenta las pendientes', async () => {
    expect(await tienePendiente(publicacion.id, beto, ejecutar)).toBe(false);
    const s = await insertarSolicitud(base(), ejecutar);
    expect(await tienePendiente(publicacion.id, beto, ejecutar)).toBe(true);
    await cerrarSolicitud(s.id, 'cancelada', { canceladaPor: beto }, ejecutar);
    expect(await tienePendiente(publicacion.id, beto, ejecutar)).toBe(false);
  });

  it('listarSolicitudesDe separa recibidas y enviadas y filtra por estado', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    const recibidas = await listarSolicitudesDe(ana, { rol: 'recibidas', limite: 20, desplazamiento: 0 }, ejecutar);
    const enviadas = await listarSolicitudesDe(beto, { rol: 'enviadas', limite: 20, desplazamiento: 0 }, ejecutar);
    expect(recibidas.filas.map((f) => f.id)).toEqual([s.id]);
    expect(enviadas.filas.map((f) => f.id)).toEqual([s.id]);
    expect((await listarSolicitudesDe(ana, { rol: 'enviadas', limite: 20, desplazamiento: 0 }, ejecutar)).total).toBe(0);
    expect(
      (await listarSolicitudesDe(ana, { rol: 'recibidas', estado: 'aceptada', limite: 20, desplazamiento: 0 }, ejecutar)).total,
    ).toBe(0);
  });

  it('marcarAceptada pone estado, fecha y plazo', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    const vence = new Date(Date.now() + 60_000);
    const fila = await marcarAceptada(s.id, vence, ejecutar);
    expect(fila.estado).toBe('aceptada');
    expect(fila.aceptada_en).toBeInstanceOf(Date);
    expect(new Date(fila.vence_en).getTime()).toBe(vence.getTime());
  });

  it('cerrarSolicitud sella cerrada_en y guarda quien cancelo', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    const fila = await cerrarSolicitud(s.id, 'cancelada', { canceladaPor: beto }, ejecutar);
    expect(fila).toMatchObject({ estado: 'cancelada' });
    expect(String(fila.cancelada_por)).toBe(String(beto));
    expect(fila.cerrada_en).toBeInstanceOf(Date);
  });

  it('cerrarPendientesDePublicacion cierra las pendientes menos la indicada', async () => {
    const carla = (await sembrarUsuario(ejecutar, { email: 'carla@ejemplo.com' })).id;
    const libroDeCarla = (
      await ejecutar(
        `INSERT INTO libros (usuario_id, titulo, autor, cantidad_total) VALUES ($1, 'El Aleph', 'Borges', 1) RETURNING id`,
        [carla],
      )
    ).rows[0];
    const s1 = await insertarSolicitud(base(), ejecutar);
    const s2 = await insertarSolicitud(
      { publicacion_id: publicacion.id, solicitante_id: carla, libro_ofrecido_id: libroDeCarla.id },
      ejecutar,
    );
    expect(await cerrarPendientesDePublicacion(publicacion.id, 'rechazada', { excepto: s1.id }, ejecutar)).toBe(1);
    expect((await bloquearSolicitud(s1.id, ejecutar)).estado).toBe('pendiente');
    expect((await bloquearSolicitud(s2.id, ejecutar)).estado).toBe('rechazada');
  });

  it('marcarConfirmacion registra cada parte una sola vez', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    const primera = await marcarConfirmacion(s.id, 'propietario', ejecutar);
    expect(primera.confirmada_propietario_en).toBeInstanceOf(Date);
    expect(primera.confirmada_solicitante_en).toBeNull();
    const otra = await marcarConfirmacion(s.id, 'propietario', ejecutar);
    expect(new Date(otra.confirmada_propietario_en).getTime()).toBe(
      new Date(primera.confirmada_propietario_en).getTime(),
    );
    expect((await marcarConfirmacion(s.id, 'solicitante', ejecutar)).confirmada_solicitante_en).toBeInstanceOf(Date);
  });

  it('solicitudesAbiertasDeUsuario trae las abiertas donde es parte, de los dos lados', async () => {
    const s = await insertarSolicitud(base(), ejecutar);
    expect((await solicitudesAbiertasDeUsuario(ana, ejecutar)).map((f) => f.id)).toEqual([s.id]);
    expect((await solicitudesAbiertasDeUsuario(beto, ejecutar)).map((f) => f.id)).toEqual([s.id]);
    await cerrarSolicitud(s.id, 'completada', {}, ejecutar);
    expect(await solicitudesAbiertasDeUsuario(ana, ejecutar)).toEqual([]);
  });
});

describe('bloqueos y movimientos de ejemplares (LET-138)', () => {
  it('bloquearPublicacion y bloquearLibro leen la fila de quien sea', async () => {
    expect(await bloquearPublicacion(publicacion.id, ejecutar)).toMatchObject({ estado: 'activa' });
    expect(await bloquearLibro(libroDeBeto.id, ejecutar)).toMatchObject({ titulo: 'Ficciones' });
    expect(await bloquearLibro(999, ejecutar)).toBeNull();
  });

  it('moverEjemplar reserva, libera y descuenta', async () => {
    expect(await moverEjemplar(libroDeBeto.id, 'reservar', ejecutar)).toMatchObject({ cantidad_total: 1, cantidad_reservada: 1 });
    expect(await moverEjemplar(libroDeBeto.id, 'liberar', ejecutar)).toMatchObject({ cantidad_total: 1, cantidad_reservada: 0 });
    await moverEjemplar(libroDeBeto.id, 'reservar', ejecutar);
    expect(await moverEjemplar(libroDeBeto.id, 'descontar', ejecutar)).toMatchObject({ cantidad_total: 0, cantidad_reservada: 0 });
  });

  it('un movimiento imposible falla en la base', async () => {
    await moverEjemplar(libroDeBeto.id, 'reservar', ejecutar);
    await expect(moverEjemplar(libroDeBeto.id, 'reservar', ejecutar)).rejects.toThrow();
    await moverEjemplar(libroDeBeto.id, 'liberar', ejecutar);
    await expect(moverEjemplar(libroDeBeto.id, 'liberar', ejecutar)).rejects.toThrow();
  });
});
