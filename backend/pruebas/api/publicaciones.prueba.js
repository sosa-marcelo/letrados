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

/** Atajos con token para las rutas de publicaciones. */
const conToken = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, cuerpo) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(cuerpo),
  put: (url, cuerpo) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(cuerpo),
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

/** Carga un libro y devuelve su id. */
async function libroDe(token, titulo = 'Rayuela') {
  const r = await conToken(token).post('/api/libros', { titulo, autor: 'Julio Cortázar', cantidad: 1 });
  return r.body.libro.id;
}

describe('endpoints de /api/publicaciones (LET-129)', () => {
  describe('GET /api/publicaciones (RF-15)', () => {
    it('sin sesion -> 200 con las activas y esMia false', async () => {
      await conPublicacion();
      const r = await request(app).get('/api/publicaciones');
      expect(r.status).toBe(200);
      expect(r.body.paginacion).toMatchObject({ pagina: 1, total: 1 });
      expect(r.body.datos[0]).toMatchObject({ estado: 'activa', esMia: false, libro: { titulo: 'Rayuela' } });
    });

    it('con sesion, la propia viene con esMia true; un token roto se ignora', async () => {
      const { token } = await conPublicacion();
      expect((await conToken(token).get('/api/publicaciones')).body.datos[0].esMia).toBe(true);
      const roto = await request(app).get('/api/publicaciones').set('Authorization', 'Bearer roto');
      expect(roto.status).toBe(200);
      expect(roto.body.datos[0].esMia).toBe(false);
    });

    it('busca con q', async () => {
      await conPublicacion();
      expect((await request(app).get('/api/publicaciones?q=ficciones')).body.paginacion.total).toBe(0);
      expect((await request(app).get('/api/publicaciones?q=RAYU')).body.paginacion.total).toBe(1);
    });
  });

  describe('GET /api/publicaciones/:id (RF-16)', () => {
    it('-> 200 con el detalle; inexistente o id invalido -> 404', async () => {
      const { publicacion } = await conPublicacion();
      const r = await request(app).get(`/api/publicaciones/${publicacion.id}`);
      expect(r.status).toBe(200);
      expect(r.body.publicacion).toMatchObject({ id: publicacion.id, libro: { disponible: 1 } });
      expect((await request(app).get('/api/publicaciones/999')).status).toBe(404);
      expect((await request(app).get('/api/publicaciones/abc')).status).toBe(404);
    });
  });

  describe('POST /api/publicaciones (RF-14)', () => {
    it('-> 201 con la publicacion y la nota recortada', async () => {
      const { token } = await cuenta();
      const libroId = await libroDe(token);
      const r = await conToken(token).post('/api/publicaciones', { libroId, nota: '  En el centro ' });
      expect(r.status).toBe(201);
      expect(r.body.publicacion).toMatchObject({ estado: 'activa', nota: 'En el centro', esMia: true });
    });

    it('sin sesion -> 401', async () => {
      expect((await request(app).post('/api/publicaciones').send({ libroId: '1' })).status).toBe(401);
    });

    it.each([[undefined], ['abc'], [0], [{}]])('libroId %j -> 400 en el campo libroId', async (libroId) => {
      const { token } = await cuenta();
      const r = await conToken(token).post('/api/publicaciones', { libroId });
      expect(r.status).toBe(400);
      expect(r.body.error.detalles.map((d) => d.campo)).toEqual(['libroId']);
    });

    it('nota de mas de 300 caracteres -> 400 en el campo nota', async () => {
      const { token } = await cuenta();
      const libroId = await libroDe(token);
      const r = await conToken(token).post('/api/publicaciones', { libroId, nota: 'n'.repeat(301) });
      expect(r.status).toBe(400);
      expect(r.body.error.detalles.map((d) => d.campo)).toEqual(['nota']);
    });

    it('un libro ajeno -> 404; uno ya publicado -> 409', async () => {
      const ana = await cuenta('ana@ejemplo.com');
      const beto = await cuenta('beto@ejemplo.com');
      const libroId = await libroDe(ana.token);
      expect((await conToken(beto.token).post('/api/publicaciones', { libroId })).status).toBe(404);
      expect((await conToken(ana.token).post('/api/publicaciones', { libroId })).status).toBe(201);
      const otra = await conToken(ana.token).post('/api/publicaciones', { libroId });
      expect(otra.status).toBe(409);
      expect(otra.body.error.codigo).toBe('ESTADO_INVALIDO');
    });
  });

  describe('PUT /api/publicaciones/:id (RF-14)', () => {
    it('-> 200 con la nota nueva; sin nota la borra', async () => {
      const { token, publicacion } = await conPublicacion();
      const r = await conToken(token).put(`/api/publicaciones/${publicacion.id}`, { nota: 'Nueva' });
      expect(r.status).toBe(200);
      expect(r.body.publicacion.nota).toBe('Nueva');
      expect((await conToken(token).put(`/api/publicaciones/${publicacion.id}`, {})).body.publicacion.nota).toBeNull();
    });

    it('una ajena -> 404', async () => {
      const { publicacion } = await conPublicacion();
      const beto = await cuenta('beto@ejemplo.com');
      expect((await conToken(beto.token).put(`/api/publicaciones/${publicacion.id}`, { nota: 'x' })).status).toBe(404);
    });
  });

  describe('DELETE /api/publicaciones/:id (RF-14)', () => {
    it('-> 200 retirada; repetir -> 409; sale de Explorar', async () => {
      const { token, publicacion } = await conPublicacion();
      const r = await conToken(token).del(`/api/publicaciones/${publicacion.id}`);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ resultado: 'retirada' });
      expect((await conToken(token).del(`/api/publicaciones/${publicacion.id}`)).status).toBe(409);
      expect((await request(app).get('/api/publicaciones')).body.paginacion.total).toBe(0);
    });
  });
});

describe('publicaciones en el resto de la API (LET-131)', () => {
  it('GET /api/usuarios/:id trae las publicaciones activas en el perfil publico (RF-08)', async () => {
    const { id, publicacion } = await conPublicacion();
    const r = await request(app).get(`/api/usuarios/${id}`);
    expect(r.status).toBe(200);
    const perfil = r.body.usuario ?? r.body;
    expect(perfil.publicaciones.map((p) => p.id)).toEqual([publicacion.id]);
    expect(JSON.stringify(perfil)).not.toMatch(/@ejemplo\.com/);
  });

  it('GET /api/libros marca publicado y publicacionId; al retirar se apaga', async () => {
    const { token, publicacion } = await conPublicacion();
    const [libro] = (await conToken(token).get('/api/libros')).body.datos;
    expect(libro).toMatchObject({ publicado: true, publicacionId: publicacion.id });
    await conToken(token).del(`/api/publicaciones/${publicacion.id}`);
    const [despues] = (await conToken(token).get('/api/libros')).body.datos;
    expect(despues).toMatchObject({ publicado: false, publicacionId: null });
  });

  it('una publicacion reservada no acepta nota, foto ni retiro (409)', async () => {
    const { token, publicacion } = await conPublicacion();
    await estado.ejecutar(`UPDATE publicaciones SET estado = 'reservada' WHERE id = $1`, [publicacion.id]);
    const yo = conToken(token);
    expect((await yo.put(`/api/publicaciones/${publicacion.id}`, { nota: 'x' })).status).toBe(409);
    expect((await yo.del(`/api/publicaciones/${publicacion.id}`)).status).toBe(409);
    const foto = await request(app)
      .put(`/api/publicaciones/${publicacion.id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG);
    expect(foto.status).toBe(409);
  });

  it('una publicacion reservada sale de Explorar pero su detalle sigue respondiendo', async () => {
    const { publicacion } = await conPublicacion();
    await estado.ejecutar(`UPDATE publicaciones SET estado = 'reservada' WHERE id = $1`, [publicacion.id]);
    expect((await request(app).get('/api/publicaciones')).body.paginacion.total).toBe(0);
    const detalle = await request(app).get(`/api/publicaciones/${publicacion.id}`);
    expect(detalle.body.publicacion.estado).toBe('reservada');
  });

  it('una cuenta bloqueada desaparece de Explorar con todas sus publicaciones', async () => {
    const { id } = await conPublicacion();
    await estado.ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE id = $1`, [id]);
    expect((await request(app).get('/api/publicaciones')).body.datos).toEqual([]);
  });
});
