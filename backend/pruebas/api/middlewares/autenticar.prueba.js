import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { autenticar } from '../../../src/api/middlewares/autenticar.js';
import { firmar } from '../../../src/infra/jwt.js';
import { prepararEntorno, limpiarEntorno } from '../../apoyo/entorno.js';

/** Request falso: autenticar solo usa req.get('authorization'). */
function reqCon(autorizacion) {
  return { get: (nombre) => (nombre === 'authorization' ? autorizacion : undefined) };
}

function esperarSesionInvalida(next) {
  expect(next).toHaveBeenCalledTimes(1);
  const [error] = next.mock.calls[0];
  expect(error.codigo).toBe('SESION_INVALIDA');
  expect(error.estado).toBe(401);
}

describe('autenticar', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());

  it('sin cabecera Authorization -> next con SESION_INVALIDA', () => {
    const next = vi.fn();
    autenticar(reqCon(undefined), {}, next);
    esperarSesionInvalida(next);
  });

  it('esquema distinto de Bearer -> next con SESION_INVALIDA', () => {
    const next = vi.fn();
    autenticar(reqCon('Basic algo'), {}, next);
    esperarSesionInvalida(next);
  });

  it('token inventado -> next con SESION_INVALIDA', () => {
    const next = vi.fn();
    autenticar(reqCon('Bearer esto-no-es-un-jwt'), {}, next);
    esperarSesionInvalida(next);
  });

  it('token valido, firmado con infra/jwt -> next() sin argumentos y req.usuario.id', () => {
    const token = firmar('42');
    const req = reqCon(`Bearer ${token}`);
    const next = vi.fn();

    autenticar(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toEqual({ id: '42' });
  });
});

describe('autenticar - token vencido', () => {
  beforeAll(() => prepararEntorno({ JWT_VENCIMIENTO: '-1s' }));
  afterAll(() => limpiarEntorno());

  it('token vencido -> next con SESION_INVALIDA, igual que cualquier otro invalido', () => {
    const token = firmar('42');
    const next = vi.fn();

    autenticar(reqCon(`Bearer ${token}`), {}, next);

    esperarSesionInvalida(next);
  });
});
