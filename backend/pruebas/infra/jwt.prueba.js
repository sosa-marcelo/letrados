import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';

import { firmar, verificar } from '../../src/infra/jwt.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

describe('jwt', () => {
  it('un token recien firmado devuelve el mismo id', () => {
    const token = firmar('42');
    expect(verificar(token)).toEqual({ id: '42' });
  });

  it('el id viaja en sub, que es lo que lee el middleware', () => {
    expect(jwt.decode(firmar('42')).sub).toBe('42');
  });

  it('un token manipulado no pasa', () => {
    const token = firmar('42');
    const roto = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(() => verificar(roto)).toThrow();
  });
});

describe('jwt - token vencido', () => {
  beforeAll(() => prepararEntorno({ JWT_VENCIMIENTO: '-1s' }));
  afterAll(() => limpiarEntorno());

  it('un token vencido no pasa', () => {
    const token = firmar('42');
    expect(() => verificar(token)).toThrow();
  });
});

describe('jwt - token con otro secreto', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());

  it('un token firmado con otro secreto no pasa', () => {
    const token = jwt.sign({ sub: '42' }, 'otro-secreto', { algorithm: 'HS256' });
    expect(() => verificar(token)).toThrow();
  });
});

describe('jwt - texto cualquiera', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());

  it('un texto cualquiera que no es token falla', () => {
    expect(() => verificar('hola')).toThrow();
  });
});
