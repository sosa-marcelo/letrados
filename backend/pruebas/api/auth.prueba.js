import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { crearApp } from '../../src/app.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

/**
 * LET-18 congela el contrato de las 5 rutas de auth. Estas pruebas fijan:
 *  - que la entrada se valida (400 DATOS_INVALIDOS con detalles),
 *  - que donde falta el dominio responde 501 NO_IMPLEMENTADO,
 *  - la forma de la respuesta,
 *  - que /api/auth/yo pide sesion (401 SESION_INVALIDA).
 *
 * El login y /auth/yo con dominio implementado (LET-13) ya no responden 501:
 * esos casos los cubren pruebas/domain/auth.prueba.js (la logica) y
 * pruebas/api/middlewares/autenticar.prueba.js (que el middleware deja pasar
 * un token valido). Probarlos aca terminaria en 500 contra la base falsa del
 * entorno de pruebas.
 */

const app = () => crearApp();

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

describe('POST /api/auth/registro', () => {
  it('sin datos -> 400 DATOS_INVALIDOS con detalles y formato unico', async () => {
    const r = await request(app()).post('/api/auth/registro').send({});

    expect(r.status).toBe(400);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
    expect(Array.isArray(r.body.error.detalles)).toBe(true);
    expect(r.body.error.detalles.length).toBeGreaterThan(0);
  });

  it('email mal formado y contrasena corta -> 400 con un detalle por campo', async () => {
    const r = await request(app())
      .post('/api/auth/registro')
      .send({ nombre: 'Ana', email: 'no-es-mail', contrasena: '123' });

    expect(r.status).toBe(400);
    const campos = r.body.error.detalles.map((d) => d.campo);
    expect(campos).toContain('email');
    expect(campos).toContain('contrasena');
  });
});

describe('POST /api/auth/login', () => {
  it('sin contrasena -> 400 DATOS_INVALIDOS', async () => {
    const r = await request(app())
      .post('/api/auth/login')
      .send({ email: 'ana@ejemplo.com' });

    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('GET /api/auth/yo', () => {
  it('sin Authorization -> 401 SESION_INVALIDA', async () => {
    const r = await request(app()).get('/api/auth/yo');

    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('SESION_INVALIDA');
  });

  it('con un Bearer invalido -> 401 SESION_INVALIDA', async () => {
    const r = await request(app())
      .get('/api/auth/yo')
      .set('Authorization', 'Bearer no.es.un.jwt');

    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('SESION_INVALIDA');
  });

  it('con un token de otro secreto -> 401 SESION_INVALIDA', async () => {
    const ajeno = jwt.sign({ sub: '42' }, 'otro-secreto', { algorithm: 'HS256' });
    const r = await request(app())
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${ajeno}`);

    expect(r.status).toBe(401);
  });
});

describe('POST /api/auth/recuperacion', () => {
  it('email mal formado -> 400 DATOS_INVALIDOS', async () => {
    const r = await request(app())
      .post('/api/auth/recuperacion')
      .send({ email: 'roto' });

    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
  });
});

describe('POST /api/auth/recuperacion/confirmar', () => {
  it('sin token y con contrasena corta -> 400 con un detalle por campo', async () => {
    const r = await request(app())
      .post('/api/auth/recuperacion/confirmar')
      .send({ contrasena: 'corta' });

    expect(r.status).toBe(400);
    const campos = r.body.error.detalles.map((d) => d.campo);
    expect(campos).toContain('token');
    expect(campos).toContain('contrasena');
  });
});
