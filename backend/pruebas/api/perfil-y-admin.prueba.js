import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

/**
 * Perfil (RF-05), perfil publico (RF-08), administracion de cuentas (RF-06,
 * RF-07) y baja (RF-09) por HTTP de punta a punta contra `pg-mem`.
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

const CONTRASENA = 'unaclave1';

/** Registra una cuenta y devuelve { id, token }. */
async function cuenta(email, nombre = 'Persona') {
  const r = await request(app)
    .post('/api/auth/registro')
    .send({ nombre, email, contrasena: CONTRASENA });
  return { id: r.body.usuario.id, token: r.body.token };
}

async function hacerAdmin(id) {
  await estado.ejecutar(`UPDATE usuarios SET rol = 'administrador' WHERE id = $1`, [id]);
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const yo = (token) => request(app).get('/api/auth/yo').set(auth(token));

describe('GET /api/perfil (RF-05)', () => {
  it('devuelve los datos propios con correo, rol, fecha y reputacion', async () => {
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');
    const r = await request(app).get('/api/perfil').set(auth(ana.token));
    expect(r.status).toBe(200);
    expect(r.body.perfil).toMatchObject({
      id: ana.id,
      nombre: 'Ana Diaz',
      email: 'ana@ejemplo.com',
      rol: 'usuario',
      reputacion: { promedio: null, cantidad: 0 },
    });
    expect(Date.parse(r.body.perfil.creadoEn)).not.toBeNaN();
  });

  it('sin sesion -> 401', async () => {
    expect((await request(app).get('/api/perfil')).status).toBe(401);
  });
});

describe('GET /api/usuarios/:id (RF-08)', () => {
  it('publico: nombre, reputacion y publicaciones; nunca correo, rol ni estado', async () => {
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');
    const r = await request(app).get(`/api/usuarios/${ana.id}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.usuario).sort()).toEqual(
      ['eliminada', 'id', 'nombre', 'publicaciones', 'reputacion'],
    );
    expect(r.body.usuario).toMatchObject({ nombre: 'Ana Diaz', eliminada: false, publicaciones: [] });
    expect(JSON.stringify(r.body)).not.toContain('ana@ejemplo.com');
  });

  it('inexistente -> 404; id mal formado -> 404', async () => {
    expect((await request(app).get('/api/usuarios/999')).status).toBe(404);
    expect((await request(app).get('/api/usuarios/abc')).status).toBe(404);
  });

  it('cuenta eliminada -> 200 con «Cuenta eliminada», sin correo (RF-09)', async () => {
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');
    await request(app).delete('/api/perfil').set(auth(ana.token)).send({ contrasena: CONTRASENA });

    const r = await request(app).get(`/api/usuarios/${ana.id}`);
    expect(r.status).toBe(200);
    expect(r.body.usuario).toMatchObject({
      nombre: 'Cuenta eliminada',
      eliminada: true,
      reputacion: { promedio: null, cantidad: 0 },
      publicaciones: [],
    });
    expect(JSON.stringify(r.body)).not.toContain('letrados.invalid');
  });
});

describe('DELETE /api/perfil (RF-09)', () => {
  it('contrasena incorrecta -> 401 CONTRASENA_INCORRECTA y la cuenta sigue igual', async () => {
    const ana = await cuenta('ana@ejemplo.com');
    const r = await request(app).delete('/api/perfil').set(auth(ana.token)).send({ contrasena: 'otra1234' });
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('CONTRASENA_INCORRECTA');
    expect((await yo(ana.token)).status).toBe(200);
  });

  it('sin contrasena -> 400', async () => {
    const ana = await cuenta('ana@ejemplo.com');
    const r = await request(app).delete('/api/perfil').set(auth(ana.token)).send({});
    expect(r.status).toBe(400);
    expect(r.body.error.detalles[0].campo).toBe('contrasena');
  });

  it('anonimiza, archiva los libros, revoca TODAS las sesiones y no deja volver a entrar', async () => {
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');
    const otraSesion = (
      await request(app).post('/api/auth/login').send({ email: 'ana@ejemplo.com', contrasena: CONTRASENA })
    ).body.token;
    await request(app)
      .post('/api/libros')
      .set(auth(ana.token))
      .send({ titulo: 'Rayuela', autor: 'Cortázar', cantidad: 1 });

    const r = await request(app).delete('/api/perfil').set(auth(ana.token)).send({ contrasena: CONTRASENA });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });

    const { rows: [fila] } = await estado.ejecutar('SELECT * FROM usuarios WHERE id = $1', [ana.id]);
    expect(fila).toMatchObject({
      nombre: 'Cuenta eliminada',
      email: `eliminada+${ana.id}@letrados.invalid`,
      estado: 'eliminada',
    });
    expect(fila.eliminada_en).not.toBeNull();
    expect(fila.contrasena_hash).toHaveLength(60);
    expect(fila.contrasena_hash.startsWith('$2')).toBe(false);

    const { rows: libros } = await estado.ejecutar('SELECT archivado_en FROM libros');
    expect(libros).toHaveLength(1);
    expect(libros[0].archivado_en).not.toBeNull();

    expect((await yo(ana.token)).status).toBe(401);
    expect((await yo(otraSesion)).status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
    expect(login.status).toBe(401);
  });

  it('tras la baja el correo original ya no esta en la base (queda .invalid)', async () => {
    const ana = await cuenta('ana@ejemplo.com');
    await request(app).delete('/api/perfil').set(auth(ana.token)).send({ contrasena: CONTRASENA });
    const { rows } = await estado.ejecutar(
      `SELECT id FROM usuarios WHERE lower(email) = 'ana@ejemplo.com'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('/api/admin/* (RF-06)', () => {
  const rutas = [
    ['get', '/api/admin/cuentas'],
    ['post', '/api/admin/cuentas/1/bloqueo'],
    ['delete', '/api/admin/cuentas/1/bloqueo'],
  ];

  it.each(rutas)('%s %s sin sesion -> 401', async (metodo, url) => {
    expect((await request(app)[metodo](url)).status).toBe(401);
  });

  it.each(rutas)('%s %s con rol usuario -> 403 ACCESO_DENEGADO', async (metodo, url) => {
    const ana = await cuenta('ana@ejemplo.com');
    const r = await request(app)[metodo](url).set(auth(ana.token));
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('ACCESO_DENEGADO');
  });
});

describe('GET /api/admin/cuentas (RF-07)', () => {
  it('lista con correo, estado y sesiones activas; busca y filtra', async () => {
    const admin = await cuenta('admin@ejemplo.com', 'Admin');
    await hacerAdmin(admin.id);
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');
    await request(app).post('/api/auth/login').send({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });

    const todo = await request(app).get('/api/admin/cuentas').set(auth(admin.token));
    expect(todo.status).toBe(200);
    expect(todo.body.paginacion).toEqual({ pagina: 1, porPagina: 20, total: 2 });
    const filaAna = todo.body.datos.find((c) => c.id === ana.id);
    expect(filaAna).toMatchObject({
      nombre: 'Ana Diaz',
      email: 'ana@ejemplo.com',
      rol: 'usuario',
      estado: 'activa',
      sesionesActivas: 2,
    });

    const busqueda = await request(app).get('/api/admin/cuentas?q=ANA').set(auth(admin.token));
    expect(busqueda.body.datos.map((c) => c.id)).toEqual([ana.id]);

    const bloqueadas = await request(app).get('/api/admin/cuentas?estado=bloqueada').set(auth(admin.token));
    expect(bloqueadas.body.datos).toEqual([]);

    const raro = await request(app)
      .get('/api/admin/cuentas?estado=cualquiera&porPagina=999&pagina=-1')
      .set(auth(admin.token));
    expect(raro.body.paginacion).toEqual({ pagina: 1, porPagina: 50, total: 2 });
  });
});

describe('bloqueo y desbloqueo (RF-07)', () => {
  it('bloquear revoca sus sesiones; el login da 403; desbloquear lo deja entrar de nuevo', async () => {
    const admin = await cuenta('admin@ejemplo.com', 'Admin');
    await hacerAdmin(admin.id);
    const ana = await cuenta('ana@ejemplo.com', 'Ana Diaz');

    const b = await request(app).post(`/api/admin/cuentas/${ana.id}/bloqueo`).set(auth(admin.token));
    expect(b.status).toBe(200);
    expect(b.body.cuenta).toMatchObject({ id: ana.id, estado: 'bloqueada', sesionesActivas: 0 });

    // Su sesion murio (revocada: 401, no 403).
    expect((await yo(ana.token)).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
    expect(login.status).toBe(403);
    expect(login.body.error.codigo).toBe('CUENTA_BLOQUEADA');

    const d = await request(app).delete(`/api/admin/cuentas/${ana.id}/bloqueo`).set(auth(admin.token));
    expect(d.status).toBe(200);
    expect(d.body.cuenta.estado).toBe('activa');

    // No resucita sesiones: el token viejo sigue muerto, pero puede volver a entrar.
    expect((await yo(ana.token)).status).toBe(401);
    const otraVez = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@ejemplo.com', contrasena: CONTRASENA });
    expect(otraVez.status).toBe(200);

    const { rows } = await estado.ejecutar('SELECT bloqueada_en FROM usuarios WHERE id = $1', [ana.id]);
    expect(rows[0].bloqueada_en).toBeNull();
  });

  it('cuenta inexistente o id mal formado -> 404', async () => {
    const admin = await cuenta('admin@ejemplo.com');
    await hacerAdmin(admin.id);
    expect((await request(app).post('/api/admin/cuentas/999/bloqueo').set(auth(admin.token))).status).toBe(404);
    expect((await request(app).delete('/api/admin/cuentas/x/bloqueo').set(auth(admin.token))).status).toBe(404);
  });

  it('un admin que pierde el rol deja de poder administrar al instante', async () => {
    const admin = await cuenta('admin@ejemplo.com');
    await hacerAdmin(admin.id);
    expect((await request(app).get('/api/admin/cuentas').set(auth(admin.token))).status).toBe(200);
    await estado.ejecutar(`UPDATE usuarios SET rol = 'usuario' WHERE id = $1`, [admin.id]);
    expect((await request(app).get('/api/admin/cuentas').set(auth(admin.token))).status).toBe(403);
  });
});
