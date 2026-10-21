import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';

import { firmar as firmarCon, verificar, vencimientoDe } from '../../src/infra/jwt.js';

const JTI = '11111111-2222-4333-8444-555555555555';
/** Firma con rol y jti fijos: las pruebas de abajo solo miran el id. */
const firmar = (id) => firmarCon(id, { rol: 'usuario', jti: JTI });
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

describe('jwt', () => {
  it('un token recien firmado devuelve el mismo id', () => {
    const token = firmar('42');
    expect(verificar(token)).toEqual({ id: '42', rol: 'usuario', jti: JTI });
  });

  it('el id viaja en sub, que es lo que lee el middleware', () => {
    expect(jwt.decode(firmar('42')).sub).toBe('42');
  });

  it('vencimientoDe devuelve el exp del token como fecha futura', () => {
    const vence = vencimientoDe(firmar('42'));
    expect(vence).toBeInstanceOf(Date);
    expect(vence.getTime()).toBeGreaterThan(Date.now());
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
