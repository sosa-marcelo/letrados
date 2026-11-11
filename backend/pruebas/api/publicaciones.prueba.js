import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

/**
 * Publicaciones por HTTP de punta a punta contra `pg-mem` (RF-14 a RF-16).
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
import { publicar } from '../../src/domain/publicaciones.js';
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

/** Una cuenta con un libro publicado. */
async function conPublicacion(email = 'ana@ejemplo.com') {
  const persona = await cuenta(email);
  const libro = await request(app)
    .post('/api/libros')
    .set('Authorization', `Bearer ${persona.token}`)
    .send({ titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 1 });
  const publicacion = await publicar(persona.id, { libroId: libro.body.libro.id });
  return { ...persona, publicacion };
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('foto de la publicacion (LET-127, RF-14 y RF-16)', () => {
  it('PUT con la imagen -> 200 y GET devuelve los mismos bytes con su tipo y cache', async () => {
    const { token, publicacion } = await conPublicacion();
    const subida = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    expect(subida.status).toBe(200);
    expect(subida.body.publicacion.tieneFoto).toBe(true);

    const foto = await request(app)
      .get(`/api/publicaciones/${publicacion.id}/foto`)
      .buffer(true)
      .parse((res, fin) => {
        const partes = [];
        res.on('data', (parte) => partes.push(parte));
        res.on('end', () => fin(null, Buffer.concat(partes)));
      });
    expect(foto.status).toBe(200);
    expect(foto.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(foto.headers['cache-control']).toBe('public, max-age=300');
    expect(foto.body.equals(JPEG)).toBe(true);
  });

  it('una foto de 3 MB -> 413 ARCHIVO_DEMASIADO_GRANDE', async () => {
    const { token, publicacion } = await conPublicacion();
    const r = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(3 * 1024 * 1024));
    expect(r.status).toBe(413);
    expect(r.body.error).toMatchObject({ codigo: 'ARCHIVO_DEMASIADO_GRANDE' });
    expect(r.body.error.mensaje).toMatch(/2 MB/);
  });

  it('un GIF -> 400 en el campo foto', async () => {
    const { token, publicacion } = await conPublicacion();
    const r = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/gif')
      .send(Buffer.from('GIF89a'));
    expect(r.status).toBe(400);
    expect(r.body.error.detalles.map((d) => d.campo)).toEqual(['foto']);
  });

  it('DELETE la quita y el GET responde 404', async () => {
    const { token, publicacion } = await conPublicacion();
    await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    const r = await request(app)
      .delete(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.publicacion.tieneFoto).toBe(false);
    expect((await request(app).get(`/api/publicaciones/${publicacion.id}/foto`)).status).toBe(404);
  });

  it('sin sesion -> 401; en una ajena -> 404; id invalido -> 404', async () => {
    const { publicacion } = await conPublicacion();
    const otra = await cuenta('beto@ejemplo.com');
    const sinSesion = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    expect(sinSesion.status).toBe(401);
    const ajena = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${otra.token}`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    expect(ajena.status).toBe(404);
    expect((await request(app).get('/api/publicaciones/abc/foto')).status).toBe(404);
  });
});
