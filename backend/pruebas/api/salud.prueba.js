import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { crearApp } from '../../src/app.js';

describe('GET /api/salud', () => {
  it('responde 200 con { estado: "ok" }', async () => {
    const respuesta = await request(crearApp()).get('/api/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: 'ok' });
  });
});
