import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

/**
 * Catalogo por HTTP de punta a punta contra `pg-mem` (RF-10 a RF-13).
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

async function cuenta(email = 'ana@ejemplo.com') {
  const r = await request(app)
    .post('/api/auth/registro')
    .send({ nombre: 'Persona', email, contrasena: 'unaclave1' });
  return r.body.token;
}

const conToken = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, cuerpo) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(cuerpo),
  put: (url, cuerpo) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(cuerpo),
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

const RAYUELA = { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 2 };

describe('sin sesion', () => {
  it.each([
    ['get', '/api/libros'],
    ['post', '/api/libros'],
    ['put', '/api/libros/1'],
    ['delete', '/api/libros/1'],
  ])('%s %s -> 401', async (metodo, url) => {
    const r = await request(app)[metodo](url);
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('SESION_INVALIDA');
  });
});

describe('POST /api/libros (RF-10)', () => {
  it('-> 201 con el libro y los tres numeros', async () => {
    const yo = conToken(await cuenta());
    const r = await yo.post('/api/libros', RAYUELA);
    expect(r.status).toBe(201);
    expect(r.body.libro).toMatchObject({ titulo: 'Rayuela', total: 2, reservada: 0, disponible: 2 });
  });

  it('acepta la cantidad como texto ("3") y recorta titulo y autor', async () => {
    const yo = conToken(await cuenta());
    const r = await yo.post('/api/libros', { titulo: '  Ficciones ', autor: ' Borges ', cantidad: '3' });
    expect(r.status).toBe(201);
    expect(r.body.libro).toMatchObject({ titulo: 'Ficciones', autor: 'Borges', total: 3 });
  });

  it.each([0, -1, 'dos', 2.5, '', null, '1.5'])(
    'cantidad %j -> 400 con detalle en el campo cantidad',
    async (cantidad) => {
      const yo = conToken(await cuenta());
      const r = await yo.post('/api/libros', { ...RAYUELA, cantidad });
      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
      expect(r.body.error.detalles.map((d) => d.campo)).toEqual(['cantidad']);
    },
  );

  it('sin titulo ni autor -> 400 con un detalle por campo', async () => {
    const yo = conToken(await cuenta());
    const r = await yo.post('/api/libros', { titulo: '  ', cantidad: 1 });
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.map((d) => d.campo).sort()).toEqual(['autor', 'titulo']);
  });

  it('titulo o autor de mas de 200 caracteres -> 400', async () => {
    const yo = conToken(await cuenta());
    const largo = 'x'.repeat(201);
    const r = await yo.post('/api/libros', { titulo: largo, autor: largo, cantidad: 1 });
    expect(r.body.error.detalles.map((d) => d.campo).sort()).toEqual(['autor', 'titulo']);
  });
});

describe('GET /api/libros (RF-13)', () => {
  it('lista solo lo propio, con paginacion y busqueda', async () => {
    const ana = conToken(await cuenta('ana@ejemplo.com'));
    const beto = conToken(await cuenta('beto@ejemplo.com'));
    await ana.post('/api/libros', RAYUELA);
    await ana.post('/api/libros', { titulo: 'Ficciones', autor: 'Borges', cantidad: 1 });
    await beto.post('/api/libros', { titulo: 'El Aleph', autor: 'Borges', cantidad: 1 });

    const todo = await ana.get('/api/libros');
    expect(todo.status).toBe(200);
    expect(todo.body.paginacion).toEqual({ pagina: 1, porPagina: 20, total: 2 });

    const busqueda = await ana.get('/api/libros?q=borg');
    expect(busqueda.body.datos.map((l) => l.titulo)).toEqual(['Ficciones']);
  });
});

describe('PUT /api/libros/:id (RF-11)', () => {
  it('-> 200 con el libro modificado', async () => {
    const yo = conToken(await cuenta());
    const { id } = (await yo.post('/api/libros', RAYUELA)).body.libro;
    const r = await yo.put(`/api/libros/${id}`, { ...RAYUELA, cantidad: 4 });
    expect(r.status).toBe(200);
    expect(r.body.libro.total).toBe(4);
  });

  it('por debajo de lo reservado -> 409 ESTADO_INVALIDO con el numero', async () => {
    const yo = conToken(await cuenta());
    const { id } = (await yo.post('/api/libros', { ...RAYUELA, cantidad: 3 })).body.libro;
    await estado.ejecutar('UPDATE libros SET cantidad_reservada = 2 WHERE id = $1', [id]);

    const r = await yo.put(`/api/libros/${id}`, { ...RAYUELA, cantidad: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
    expect(r.body.error.mensaje).toContain('2');
  });

  it('libro ajeno -> 404', async () => {
    const ana = conToken(await cuenta('ana@ejemplo.com'));
    const beto = conToken(await cuenta('beto@ejemplo.com'));
    const { id } = (await beto.post('/api/libros', RAYUELA)).body.libro;
    const r = await ana.put(`/api/libros/${id}`, RAYUELA);
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('id que no es numero -> 404, no 500', async () => {
    const yo = conToken(await cuenta());
    expect((await yo.put('/api/libros/abc', RAYUELA)).status).toBe(404);
  });

  it('datos invalidos -> 400 aunque el libro exista', async () => {
    const yo = conToken(await cuenta());
    const { id } = (await yo.post('/api/libros', RAYUELA)).body.libro;
    expect((await yo.put(`/api/libros/${id}`, { ...RAYUELA, cantidad: 0 })).status).toBe(400);
  });
});

describe('DELETE /api/libros/:id (RF-12)', () => {
  it('sin historial -> 200 { resultado: "eliminado" } y deja de aparecer', async () => {
    const yo = conToken(await cuenta());
    const { id } = (await yo.post('/api/libros', RAYUELA)).body.libro;

    const r = await yo.del(`/api/libros/${id}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ resultado: 'eliminado' });
    expect((await yo.get('/api/libros')).body.datos).toHaveLength(0);
  });

  it('libro ajeno -> 404', async () => {
    const ana = conToken(await cuenta('ana@ejemplo.com'));
    const beto = conToken(await cuenta('beto@ejemplo.com'));
    const { id } = (await beto.post('/api/libros', RAYUELA)).body.libro;
    expect((await ana.del(`/api/libros/${id}`)).status).toBe(404);
  });

  it('id mal formado -> 404', async () => {
    const yo = conToken(await cuenta());
    expect((await yo.del('/api/libros/0')).status).toBe(404);
  });
});
