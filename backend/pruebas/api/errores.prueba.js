import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import { crearApp } from '../../src/app.js';
import { ErrorDominio } from '../../src/domain/errores.js';
import { rutaNoEncontrada } from '../../src/api/middlewares/rutaNoEncontrada.js';
import { manejadorErrores } from '../../src/api/middlewares/manejadorErrores.js';

/** App minima con rutas que fallan a proposito, para ejercitar el manejador. */
function appDePrueba() {
  const app = express();
  app.get('/api/explota', () => {
    throw new Error('detalle interno que no debe salir');
  });
  app.get('/api/dominio', () => {
    throw new ErrorDominio('EMAIL_DUPLICADO', 409, 'Ya existe una cuenta con ese correo');
  });
  app.use('/api', rutaNoEncontrada);
  app.use('/api', manejadorErrores);
  return app;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('terminador 404 de /api (bug de la SPA)', () => {
  it('GET /api/loquesea -> 404 con content-type application/json', async () => {
    const respuesta = await request(crearApp()).get('/api/loquesea');

    expect(respuesta.status).toBe(404);
    expect(respuesta.headers['content-type']).toMatch(/application\/json/);
    expect(respuesta.body).toEqual({
      error: {
        codigo: 'RUTA_NO_ENCONTRADA',
        mensaje: expect.any(String),
        detalles: [],
      },
    });
  });

  it('no rompe las rutas que si existen', async () => {
    const respuesta = await request(crearApp()).get('/api/salud');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: 'ok' });
  });
});

describe('manejadorErrores (formato unico)', () => {
  it('un ErrorDominio sale con su codigo, estado y detalles', async () => {
    const respuesta = await request(appDePrueba()).get('/api/dominio');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: {
        codigo: 'EMAIL_DUPLICADO',
        mensaje: 'Ya existe una cuenta con ese correo',
        detalles: [],
      },
    });
  });

  it('un error cualquiera sale 500 ERROR_INTERNO sin filtrar el detalle ni el stack', async () => {
    const respuesta = await request(appDePrueba()).get('/api/explota');

    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.codigo).toBe('ERROR_INTERNO');
    expect(respuesta.body.error.detalles).toEqual([]);

    const texto = JSON.stringify(respuesta.body);
    expect(texto).not.toContain('detalle interno');
    expect(texto.toLowerCase()).not.toContain('stack');
    expect(texto).not.toContain('at ');
  });

  it('registra los 500 por error y no por warn', async () => {
    await request(appDePrueba()).get('/api/explota');
    expect(console.error).toHaveBeenCalled();
  });

  it('registra los 4xx por warn y no por error', async () => {
    await request(appDePrueba()).get('/api/dominio');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('un cuerpo JSON mal formado sale 400 JSON_INVALIDO en JSON, no en HTML', async () => {
    const respuesta = await request(crearApp())
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{roto');

    expect(respuesta.status).toBe(400);
    expect(respuesta.headers['content-type']).toMatch(/application\/json/);
    expect(respuesta.body.error.codigo).toBe('JSON_INVALIDO');
    // No se le devuelve al cliente lo que mando.
    expect(JSON.stringify(respuesta.body)).not.toContain('{roto');
  });
});
