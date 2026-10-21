import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * `autenticar` consulta la base (sesion vigente y usuario). Aca se reemplazan
 * las dos funciones de `data` para probar cada rama del middleware sin base.
 */
const datos = vi.hoisted(() => ({ sesion: null, usuario: null }));

vi.mock('../../../src/data/sesiones.js', () => ({
  buscarSesionVigente: vi.fn(async () => datos.sesion),
}));
vi.mock('../../../src/data/usuarios.js', () => ({
  buscarUsuarioPorId: vi.fn(async () => datos.usuario),
}));

import { autenticar } from '../../../src/api/middlewares/autenticar.js';
import { exigirRol } from '../../../src/api/middlewares/exigirRol.js';
import { firmar } from '../../../src/infra/jwt.js';
import { prepararEntorno, limpiarEntorno } from '../../apoyo/entorno.js';

const JTI = '11111111-2222-4333-8444-555555555555';

/** Request falso: autenticar solo usa req.get('authorization'). */
function reqCon(autorizacion) {
  return { get: (nombre) => (nombre === 'authorization' ? autorizacion : undefined) };
}

function tokenValido(id = '42') {
  return firmar(id, { rol: 'usuario', jti: JTI });
}

function errorDe(next) {
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0][0];
}

function esperarSesionInvalida(next) {
  const error = errorDe(next);
  expect(error.codigo).toBe('SESION_INVALIDA');
  expect(error.estado).toBe(401);
}

describe('autenticar', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());
  beforeEach(() => {
    datos.sesion = { jti: JTI, usuario_id: '42' };
    datos.usuario = { id: '42', nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', estado: 'activa' };
  });

  it('sin cabecera Authorization -> SESION_INVALIDA', async () => {
    const next = vi.fn();
    await autenticar(reqCon(undefined), {}, next);
    esperarSesionInvalida(next);
  });

  it('esquema distinto de Bearer -> SESION_INVALIDA', async () => {
    const next = vi.fn();
    await autenticar(reqCon('Basic algo'), {}, next);
    esperarSesionInvalida(next);
  });

  it('token inventado -> SESION_INVALIDA', async () => {
    const next = vi.fn();
    await autenticar(reqCon('Bearer esto-no-es-un-jwt'), {}, next);
    esperarSesionInvalida(next);
  });

  it('token firmado pero sin jti (formato del ciclo 1) -> SESION_INVALIDA', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const viejo = jwt.sign({ sub: '42' }, process.env.JWT_SECRETO, { algorithm: 'HS256' });
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${viejo}`), {}, next);
    esperarSesionInvalida(next);
  });

  it('sesion revocada o vencida (no hay fila vigente) -> SESION_INVALIDA', async () => {
    datos.sesion = null;
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);
    esperarSesionInvalida(next);
  });

  it('la sesion es de otro usuario que el del token -> SESION_INVALIDA', async () => {
    datos.sesion = { jti: JTI, usuario_id: '99' };
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);
    esperarSesionInvalida(next);
  });

  it('el usuario ya no existe -> SESION_INVALIDA', async () => {
    datos.usuario = null;
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);
    esperarSesionInvalida(next);
  });

  it.each(['bloqueada', 'eliminada'])('cuenta %s -> 403 CUENTA_BLOQUEADA', async (estado) => {
    datos.usuario.estado = estado;
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);
    const error = errorDe(next);
    expect(error.codigo).toBe('CUENTA_BLOQUEADA');
    expect(error.estado).toBe(403);
  });

  it('todo en orden -> next() sin argumentos y req.usuario = { id, rol, estado, jti }', async () => {
    const req = reqCon(`Bearer ${tokenValido()}`);
    const next = vi.fn();

    await autenticar(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toEqual({ id: '42', rol: 'usuario', estado: 'activa', jti: JTI });
  });

  it('el rol sale de la fila de usuarios, no del token', async () => {
    datos.usuario.rol = 'administrador'; // el token dice 'usuario'
    const req = reqCon(`Bearer ${tokenValido()}`);
    const next = vi.fn();

    await autenticar(req, {}, next);

    expect(req.usuario.rol).toBe('administrador');
  });

  it('un error de la base no se disfraza de 401: sube tal cual', async () => {
    const { buscarSesionVigente } = await import('../../../src/data/sesiones.js');
    buscarSesionVigente.mockRejectedValueOnce(new Error('se cayo la base'));
    const next = vi.fn();

    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);

    expect(errorDe(next).message).toBe('se cayo la base');
  });
});

describe('autenticar - token vencido', () => {
  beforeAll(() => prepararEntorno({ JWT_VENCIMIENTO: '-1s' }));
  afterAll(() => limpiarEntorno());

  it('token vencido -> SESION_INVALIDA, igual que cualquier otro invalido', async () => {
    const next = vi.fn();
    await autenticar(reqCon(`Bearer ${tokenValido()}`), {}, next);
    esperarSesionInvalida(next);
  });
});

describe('exigirRol', () => {
  it('rol que coincide -> next() sin error', () => {
    const next = vi.fn();
    exigirRol('administrador')({ usuario: { rol: 'administrador' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rol que no coincide -> 403 ACCESO_DENEGADO', () => {
    const next = vi.fn();
    exigirRol('administrador')({ usuario: { rol: 'usuario' } }, {}, next);
    const error = errorDe(next);
    expect(error.codigo).toBe('ACCESO_DENEGADO');
    expect(error.estado).toBe(403);
  });

  it('sin req.usuario (montado sin autenticar) -> ACCESO_DENEGADO, nunca pasa', () => {
    const next = vi.fn();
    exigirRol('administrador')({}, {}, next);
    expect(errorDe(next).codigo).toBe('ACCESO_DENEGADO');
  });
});
