import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const datos = vi.hoisted(() => ({ sesion: null, usuario: null }));

vi.mock('../../../src/data/sesiones.js', () => ({
  buscarSesionVigente: vi.fn(async () => datos.sesion),
}));
vi.mock('../../../src/data/usuarios.js', () => ({
  buscarUsuarioPorId: vi.fn(async () => datos.usuario),
}));

import { sesionOpcional } from '../../../src/api/middlewares/sesionOpcional.js';
import { firmar } from '../../../src/infra/jwt.js';
import { prepararEntorno, limpiarEntorno } from '../../apoyo/entorno.js';

const JTI = '11111111-2222-4333-8444-555555555555';
const reqCon = (a) => ({ get: (n) => (n === 'authorization' ? a : undefined) });
const bearer = () => `Bearer ${firmar('42', { rol: 'usuario', jti: JTI })}`;

describe('sesionOpcional', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());
  beforeEach(() => {
    datos.sesion = { jti: JTI, usuario_id: '42' };
    datos.usuario = { id: '42', rol: 'usuario', estado: 'activa' };
  });

  async function correr(autorizacion) {
    const req = reqCon(autorizacion);
    const next = vi.fn();
    await sesionOpcional(req, {}, next);
    return { req, next };
  }

  it('sesion valida -> req.usuario cargado', async () => {
    const { req, next } = await correr(bearer());
    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toEqual({ id: '42', rol: 'usuario', estado: 'activa', jti: JTI });
  });

  it.each([
    ['sin cabecera', undefined, () => {}],
    ['token basura', 'Bearer basura', () => {}],
    ['sesion revocada', null, () => (datos.sesion = null)],
    ['sesion de otro usuario', null, () => (datos.sesion = { jti: JTI, usuario_id: '7' })],
    ['usuario inexistente', null, () => (datos.usuario = null)],
    ['cuenta bloqueada', null, () => (datos.usuario.estado = 'bloqueada')],
  ])('%s -> sigue sin usuario y sin error', async (_n, cabecera, preparar) => {
    preparar();
    const { req, next } = await correr(cabecera === null ? bearer() : cabecera);
    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toBeUndefined();
  });

  it('token sin jti -> sigue sin usuario', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const viejo = jwt.sign({ sub: '42' }, process.env.JWT_SECRETO, { algorithm: 'HS256' });
    const { req } = await correr(`Bearer ${viejo}`);
    expect(req.usuario).toBeUndefined();
  });

  it('un error de la base si sube', async () => {
    const { buscarSesionVigente } = await import('../../../src/data/sesiones.js');
    buscarSesionVigente.mockRejectedValueOnce(new Error('caida'));
    const { next } = await correr(bearer());
    expect(next.mock.calls[0][0].message).toBe('caida');
  });
});
