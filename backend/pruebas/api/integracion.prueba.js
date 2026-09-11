import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

/**
 * Pruebas de integracion de los cinco puntos de acceso de auth: de punta a
 * punta por HTTP, con `pg-mem` en vez del pool real y el envio de correo
 * capturado. No tocan `backend/src/`: reemplazan `infra/bd.js` e
 * `infra/correo.js` completos con `vi.mock`, y como toda funcion de `data`
 * recibe su ejecutor de `consultar` cuando no le pasan uno (nadie en las
 * rutas ni en `domain` le pasa `ejecutar` explicito), la app entera termina
 * hablando con la base en memoria sin que el codigo de produccion lo sepa.
 *
 * `vi.mock` se iza por encima de las declaraciones del archivo, asi que el
 * estado que el mock necesita leer se arma con `vi.hoisted`.
 */
const estado = vi.hoisted(() => ({ ejecutar: null, correos: [] }));

vi.mock('../../src/infra/bd.js', () => ({
  consultar: (sql, parametros) => estado.ejecutar(sql, parametros),
  obtenerPool: () => {
    throw new Error('no se usa en pruebas');
  },
  obtenerCliente: () => {
    throw new Error('no se usa en pruebas');
  },
  cerrarPool: async () => {},
}));

vi.mock('../../src/infra/correo.js', () => ({
  enviarCorreo: async (mensaje) => {
    estado.correos.push(mensaje);
  },
}));

import { crearApp } from '../../src/app.js';
import { obtenerConfig } from '../../src/infra/config.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

beforeEach(async () => {
  ({ ejecutar: estado.ejecutar } = await crearBdMemoria());
  estado.correos.length = 0;
});

const DATOS_REGISTRO = {
  nombre: 'Ana Diaz',
  email: 'ana@ejemplo.com',
  contrasena: 'unaclave1',
};

/** Saca el token en claro del texto del correo de recuperacion capturado. */
function tokenDelCorreo(mensaje) {
  const { urlFrontend } = obtenerConfig();
  const patron = new RegExp(
    `${urlFrontend.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/recuperar/([^\\s]+)`,
  );
  const [, token] = mensaje.texto.match(patron);
  return token;
}

describe('registro', () => {
  it('con datos validos -> 201, token y usuario con exactamente id, nombre y email', async () => {
    const r = await request(crearApp()).post('/api/auth/registro').send(DATOS_REGISTRO);

    expect(r.status).toBe(201);
    expect(typeof r.body.token).toBe('string');
    expect(Object.keys(r.body.usuario).sort()).toEqual(['email', 'id', 'nombre']);
    expect(r.body.usuario.nombre).toBe(DATOS_REGISTRO.nombre);
    expect(r.body.usuario.email).toBe(DATOS_REGISTRO.email);
  });

  it('con correo repetido -> 409 EMAIL_DUPLICADO, tambien con otras mayusculas', async () => {
    const app = crearApp();
    await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);

    const repetido = await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe('EMAIL_DUPLICADO');

    const conMayusculas = await request(app)
      .post('/api/auth/registro')
      .send({ ...DATOS_REGISTRO, email: DATOS_REGISTRO.email.toUpperCase() });
    expect(conMayusculas.status).toBe(409);
    expect(conMayusculas.body.error.codigo).toBe('EMAIL_DUPLICADO');
  });
});

describe('login', () => {
  it('correcto -> 200, con el mismo usuario que devolvio el registro', async () => {
    const app = crearApp();
    const registro = await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: DATOS_REGISTRO.email, contrasena: DATOS_REGISTRO.contrasena });

    expect(login.status).toBe(200);
    expect(login.body.usuario).toEqual(registro.body.usuario);
  });

  it('incorrecto -> 401 CREDENCIALES_INVALIDAS', async () => {
    const app = crearApp();
    await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);

    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: DATOS_REGISTRO.email, contrasena: 'la-que-no-es1' });

    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });
});

describe('GET /api/auth/yo', () => {
  it('sin cabecera -> 401; con el token del registro -> 200 con el usuario', async () => {
    const app = crearApp();
    const registro = await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);

    const sinToken = await request(app).get('/api/auth/yo');
    expect(sinToken.status).toBe(401);
    expect(sinToken.body.error.codigo).toBe('SESION_INVALIDA');

    const conToken = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${registro.body.token}`);
    expect(conToken.status).toBe(200);
    expect(conToken.body.usuario).toEqual(registro.body.usuario);
  });
});

describe('circuito completo de recuperacion', () => {
  it('pedir, confirmar con la contrasena nueva, y loguear con la nueva pero no con la vieja', async () => {
    const app = crearApp();
    await request(app).post('/api/auth/registro').send(DATOS_REGISTRO);

    const pedido = await request(app)
      .post('/api/auth/recuperacion')
      .send({ email: DATOS_REGISTRO.email });
    expect(pedido.status).toBe(200);
    expect(estado.correos).toHaveLength(1);

    const token = tokenDelCorreo(estado.correos[0]);
    const contrasenaNueva = 'otraclave2';

    const confirmar = await request(app)
      .post('/api/auth/recuperacion/confirmar')
      .send({ token, contrasena: contrasenaNueva });
    expect(confirmar.status).toBe(200);

    const loginConNueva = await request(app)
      .post('/api/auth/login')
      .send({ email: DATOS_REGISTRO.email, contrasena: contrasenaNueva });
    expect(loginConNueva.status).toBe(200);

    const loginConVieja = await request(app)
      .post('/api/auth/login')
      .send({ email: DATOS_REGISTRO.email, contrasena: DATOS_REGISTRO.contrasena });
    expect(loginConVieja.status).toBe(401);
    expect(loginConVieja.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });
});
