import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Router } from 'express';

/**
 * LET-54 · Sesiones revocables y roles, de punta a punta por HTTP contra
 * `pg-mem`. Mismo esquema que `integracion.prueba.js`: se reemplaza
 * `infra/bd.js` completo y la app habla con la base en memoria.
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

import express from 'express';
import { crearApp } from '../../src/app.js';
import { autenticar } from '../../src/api/middlewares/autenticar.js';
import { exigirRol } from '../../src/api/middlewares/exigirRol.js';
import { manejadorErrores } from '../../src/api/middlewares/manejadorErrores.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

let app;
beforeEach(async () => {
  ({ ejecutar: estado.ejecutar } = await crearBdMemoria());
  app = crearApp();
});

const ANA = { nombre: 'Ana Diaz', email: 'ana@ejemplo.com', contrasena: 'unaclave1' };

async function registrarYEntrar(datos = ANA) {
  await request(app).post('/api/auth/registro').send(datos);
  const r = await request(app)
    .post('/api/auth/login')
    .send({ email: datos.email, contrasena: datos.contrasena });
  return r.body.token;
}

const yo = (token) => request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`);
const salir = (token) =>
  request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

describe('POST /api/auth/logout (RF-03)', () => {
  it('-> 200 { ok: true }', async () => {
    const token = await registrarYEntrar();
    const r = await salir(token);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('el mismo token da 401 SESION_INVALIDA en la peticion siguiente', async () => {
    const token = await registrarYEntrar();
    expect((await yo(token)).status).toBe(200);

    await salir(token);

    const r = await yo(token);
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('SESION_INVALIDA');
  });

  it('cerrar una sesion no cierra las otras del mismo usuario', async () => {
    const enLaCompu = await registrarYEntrar();
    const enElCelular = (
      await request(app).post('/api/auth/login').send({ email: ANA.email, contrasena: ANA.contrasena })
    ).body.token;

    await salir(enLaCompu);

    expect((await yo(enLaCompu)).status).toBe(401);
    expect((await yo(enElCelular)).status).toBe(200);
  });

  it('sin token -> 401', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
  });
});

describe('rol en la sesion (RF-02, RF-06)', () => {
  it('registro, login y /yo devuelven rol usuario', async () => {
    const reg = await request(app).post('/api/auth/registro').send(ANA);
    expect(reg.body.usuario.rol).toBe('usuario');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, contrasena: ANA.contrasena });
    expect(login.body.usuario.rol).toBe('usuario');

    expect((await yo(login.body.token)).body.usuario.rol).toBe('usuario');
  });

  it('el token del registro ya sirve para /yo (abre sesion)', async () => {
    const reg = await request(app).post('/api/auth/registro').send(ANA);
    expect((await yo(reg.body.token)).status).toBe(200);
  });

  it('un cambio de rol en la base se ve en /yo sin token nuevo', async () => {
    const token = await registrarYEntrar();
    await estado.ejecutar(`UPDATE usuarios SET rol = 'administrador' WHERE email = $1`, [ANA.email]);
    expect((await yo(token)).body.usuario.rol).toBe('administrador');
  });
});

describe('cuenta bloqueada o eliminada (RF-02)', () => {
  it.each(['bloqueada', 'eliminada'])(
    'login con credenciales correctas y cuenta %s -> 403 CUENTA_BLOQUEADA',
    async (estadoCuenta) => {
      await request(app).post('/api/auth/registro').send(ANA);
      await estado.ejecutar(`UPDATE usuarios SET estado = $1 WHERE email = $2`, [
        estadoCuenta,
        ANA.email,
      ]);

      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: ANA.email, contrasena: ANA.contrasena });

      expect(r.status).toBe(403);
      expect(r.body.error.codigo).toBe('CUENTA_BLOQUEADA');
      expect(r.body.token).toBeUndefined();
    },
  );

  it('cuenta bloqueada con contrasena INCORRECTA -> 401 generico, no revela el bloqueo', async () => {
    await request(app).post('/api/auth/registro').send(ANA);
    await estado.ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE email = $1`, [ANA.email]);

    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, contrasena: 'otraclave9' });

    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('una sesion abierta deja de servir si la cuenta pasa a bloqueada -> 403', async () => {
    const token = await registrarYEntrar();
    await estado.ejecutar(`UPDATE usuarios SET estado = 'bloqueada' WHERE email = $1`, [ANA.email]);

    const r = await yo(token);
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('CUENTA_BLOQUEADA');
  });
});

describe('exigirRol montado detras de autenticar (RF-06)', () => {
  /** App minima con una ruta de administrador, para probar la cadena entera. */
  function appConRutaAdmin() {
    const api = Router();
    api.get('/solo-admin', autenticar, exigirRol('administrador'), (_req, res) =>
      res.json({ ok: true }),
    );
    api.use(manejadorErrores);
    const prueba = express();
    prueba.use('/api', api);
    return prueba;
  }

  it('un usuario comun -> 403 ACCESO_DENEGADO', async () => {
    const token = await registrarYEntrar();
    const r = await request(appConRutaAdmin())
      .get('/api/solo-admin')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('ACCESO_DENEGADO');
  });

  it('un administrador -> pasa', async () => {
    const token = await registrarYEntrar();
    await estado.ejecutar(`UPDATE usuarios SET rol = 'administrador' WHERE email = $1`, [ANA.email]);
    const r = await request(appConRutaAdmin())
      .get('/api/solo-admin')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('sin sesion -> 401, no 403', async () => {
    const r = await request(appConRutaAdmin()).get('/api/solo-admin');
    expect(r.status).toBe(401);
  });
});
