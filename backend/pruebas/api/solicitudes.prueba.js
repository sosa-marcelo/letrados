import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

/**
 * Solicitudes e intercambios por HTTP de punta a punta contra `pg-mem` (RF-17 a RF-21).
 */
const estado = vi.hoisted(() => ({ ejecutar: null }));

vi.mock('../../src/infra/bd.js', () => ({
  consultar: (sql, parametros) => estado.ejecutar(sql, parametros),
  obtenerPool: () => {
    throw new Error('no se usa en pruebas');
  },
  obtenerCliente: async () => ({
    query: (sql, parametros) => estado.ejecutar(sql, parametros),
    release: () => {},
  }),
  cerrarPool: async () => {},
}));

vi.mock('../../src/infra/correo.js', () => ({ enviarCorreo: async () => {} }));

import { crearApp } from '../../src/app.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

let app;
beforeEach(async () => {
  ({ ejecutar: estado.ejecutar } = await crearBdMemoria());
  app = crearApp();
});

/** Registra una cuenta y devuelve su token y su id. */
async function cuenta(email = 'ana@ejemplo.com') {
  const r = await request(app)
    .post('/api/auth/registro')
    .send({ nombre: 'Persona', email, contrasena: 'unaclave1' });
  return { token: r.body.token, id: String(r.body.usuario.id) };
}

const conToken = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, cuerpo = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(cuerpo),
});

/** Una cuenta con un libro; si `publicarlo`, tambien lo publica. */
async function personaConLibro(email, titulo, publicarlo = false) {
  const persona = await cuenta(email);
  const yo = conToken(persona.token);
  const libro = (await yo.post('/api/libros', { titulo, autor: 'Autor', cantidad: 1 })).body.libro;
  const publicacion = publicarlo
    ? (await yo.post('/api/publicaciones', { libroId: libro.id })).body.publicacion
    : null;
  return { ...persona, yo, libro, publicacion };
}

let ana;
let beto;
beforeEach(async () => {
  ana = await personaConLibro('ana@ejemplo.com', 'Rayuela', true);
  beto = await personaConLibro('beto@ejemplo.com', 'Ficciones');
});

const pedido = () => ({ publicacionId: ana.publicacion.id, libroOfrecidoId: beto.libro.id });

describe('/api/solicitudes (LET-144)', () => {
  it('sin sesion -> 401', async () => {
    expect((await request(app).get('/api/solicitudes')).status).toBe(401);
    expect((await request(app).post('/api/solicitudes').send(pedido())).status).toBe(401);
  });

  it('el circuito completo: solicitar, aceptar, confirmar los dos (RF-17 a RF-21)', async () => {
    const creada = await beto.yo.post('/api/solicitudes', pedido());
    expect(creada.status).toBe(201);
    const id = creada.body.solicitud.id;
    expect(creada.body.solicitud).toMatchObject({ estado: 'pendiente', libroOfrecido: { titulo: 'Ficciones' } });

    const recibidas = await ana.yo.get('/api/solicitudes?rol=recibidas');
    expect(recibidas.body.datos[0]).toMatchObject({ id, puedo: { aceptar: true } });

    const aceptada = await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    expect(aceptada.status).toBe(200);
    expect(aceptada.body.solicitud.estado).toBe('aceptada');
    expect((await request(app).get('/api/publicaciones')).body.paginacion.total).toBe(0);

    expect((await beto.yo.post(`/api/solicitudes/${id}/confirmar`)).body.solicitud.estado).toBe('aceptada');
    const completada = await ana.yo.post(`/api/solicitudes/${id}/confirmar`);
    expect(completada.body.solicitud).toMatchObject({ estado: 'completada', confirmadaPorContraparte: true });

    const [libroDeAna] = (await ana.yo.get('/api/libros')).body.datos;
    expect(libroDeAna).toMatchObject({ total: 0, reservada: 0, disponible: 0 });
  });

  it('rechazar y cancelar responden la solicitud como queda', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    expect((await ana.yo.post(`/api/solicitudes/${id}/rechazar`)).body.solicitud.estado).toBe('rechazada');
    const otra = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    expect((await beto.yo.post(`/api/solicitudes/${otra}/cancelar`)).body.solicitud.estado).toBe('cancelada');
  });

  it.each([[{}], [{ publicacionId: 'x', libroOfrecidoId: '1' }]])('cuerpo %j -> 400 con detalle por campo', async (cuerpo) => {
    const r = await beto.yo.post('/api/solicitudes', cuerpo);
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.map((d) => d.campo)).toContain('publicacionId');
  });

  it('solicitar la propia -> 409; el solicitante que acepta -> 403; un tercero -> 404', async () => {
    const propio = await ana.yo.post('/api/solicitudes', { publicacionId: ana.publicacion.id, libroOfrecidoId: ana.libro.id });
    expect(propio.status).toBe(409);

    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    expect((await beto.yo.post(`/api/solicitudes/${id}/aceptar`)).status).toBe(403);

    const carla = conToken((await cuenta('carla@ejemplo.com')).token);
    expect((await carla.get(`/api/solicitudes/${id}`)).status).toBe(404);
    expect((await carla.post(`/api/solicitudes/${id}/cancelar`)).status).toBe(404);
    expect((await carla.get('/api/solicitudes/abc')).status).toBe(404);
  });

  it('GET /api/solicitudes/:id lo ve cada parte desde su lado', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    expect((await ana.yo.get(`/api/solicitudes/${id}`)).body.solicitud).toMatchObject({ soyPropietario: true, contraparte: { id: beto.id } });
    expect((await beto.yo.get(`/api/solicitudes/${id}`)).body.solicitud).toMatchObject({ soyPropietario: false, contraparte: { id: ana.id } });
  });

  it('enviadas trae las de quien solicito y el estado filtra', async () => {
    await beto.yo.post('/api/solicitudes', pedido());
    expect((await beto.yo.get('/api/solicitudes?rol=enviadas')).body.paginacion.total).toBe(1);
    expect((await beto.yo.get('/api/solicitudes?rol=enviadas&estado=aceptada')).body.paginacion.total).toBe(0);
  });
});

describe('integracion con publicaciones y catalogo (LET-148)', () => {
  it('cancelar una aceptada devuelve la publicacion a Explorar y libera los dos libros', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    expect((await request(app).get('/api/publicaciones')).body.paginacion.total).toBe(0);
    expect((await beto.yo.get('/api/libros')).body.datos[0]).toMatchObject({ reservada: 1, disponible: 0 });

    await beto.yo.post(`/api/solicitudes/${id}/cancelar`);
    expect((await request(app).get('/api/publicaciones')).body.paginacion.total).toBe(1);
    expect((await beto.yo.get('/api/libros')).body.datos[0]).toMatchObject({ reservada: 0, disponible: 1 });
  });
});

describe('POST /api/solicitudes/:id/reportes (LET-156, RF-24)', () => {
  it('-> 201 sobre una flagueada; 409 sobre una aceptada en plazo; 400 sin descripcion', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    expect((await beto.yo.post(`/api/solicitudes/${id}/reportes`, { descripcion: 'x' })).status).toBe(409);

    await estado.ejecutar(`UPDATE solicitudes SET vence_en = now() - interval '1 second' WHERE id = $1`, [id]);
    const vacio = await beto.yo.post(`/api/solicitudes/${id}/reportes`, { descripcion: '   ' });
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.detalles.map((d) => d.campo)).toEqual(['descripcion']);

    const r = await beto.yo.post(`/api/solicitudes/${id}/reportes`, { descripcion: ' No vino ' });
    expect(r.status).toBe(201);
    expect(r.body.reporte).toMatchObject({ descripcion: 'No vino', autor: { id: beto.id } });
  });
});

describe('GET /api/admin/flagueados (LET-157)', () => {
  it('un usuario comun -> 403; el administrador ve el flagueado con sus reportes', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    await estado.ejecutar(`UPDATE solicitudes SET vence_en = now() - interval '1 second' WHERE id = $1`, [id]);
    await beto.yo.post(`/api/solicitudes/${id}/reportes`, { descripcion: 'No vino' });

    expect((await beto.yo.get('/api/admin/flagueados')).status).toBe(403);

    const admin = await cuenta('admin@ejemplo.com');
    await estado.ejecutar(`UPDATE usuarios SET rol = 'administrador' WHERE id = $1`, [admin.id]);
    const r = await conToken(admin.token).get('/api/admin/flagueados');
    expect(r.status).toBe(200);
    expect(r.body.datos[0]).toMatchObject({ id, estado: 'flagueada', reportes: [{ descripcion: 'No vino' }] });
  });
});

describe('POST /api/solicitudes/:id/valoracion (LET-163, RF-25)', () => {
  it('-> 201 sobre una completada; repetir -> 409; puntaje invalido -> 400', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    expect((await beto.yo.post(`/api/solicitudes/${id}/valoracion`, { puntaje: 5 })).status).toBe(409);
    await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    await ana.yo.post(`/api/solicitudes/${id}/confirmar`);
    await beto.yo.post(`/api/solicitudes/${id}/confirmar`);

    expect((await beto.yo.post(`/api/solicitudes/${id}/valoracion`, { puntaje: 9 })).status).toBe(400);
    const r = await beto.yo.post(`/api/solicitudes/${id}/valoracion`, { puntaje: 5, comentario: 'Todo bien' });
    expect(r.status).toBe(201);
    expect(r.body.valoracion).toMatchObject({ puntaje: 5, comentario: 'Todo bien' });
    expect((await beto.yo.post(`/api/solicitudes/${id}/valoracion`, { puntaje: 4 })).status).toBe(409);
  });
});

describe('GET /api/usuarios/:id/valoraciones (LET-165, RF-27)', () => {
  it('publica, con la valoracion recibida; id invalido -> 404', async () => {
    const id = (await beto.yo.post('/api/solicitudes', pedido())).body.solicitud.id;
    await ana.yo.post(`/api/solicitudes/${id}/aceptar`);
    await ana.yo.post(`/api/solicitudes/${id}/confirmar`);
    await beto.yo.post(`/api/solicitudes/${id}/confirmar`);
    await beto.yo.post(`/api/solicitudes/${id}/valoracion`, { puntaje: 4, comentario: 'Bien' });

    const r = await request(app).get(`/api/usuarios/${ana.id}/valoraciones`);
    expect(r.status).toBe(200);
    expect(r.body.datos[0]).toMatchObject({ puntaje: 4, comentario: 'Bien', autor: { id: beto.id } });
    expect((await request(app).get('/api/usuarios/abc/valoraciones')).status).toBe(404);
  });
});
