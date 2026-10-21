import { describe, it, expect, beforeEach } from 'vitest';

import {
  insertarSesion,
  buscarSesionVigente,
  revocarSesion,
  revocarSesionesDeUsuario,
  borrarSesionesVencidas,
} from '../../src/data/sesiones.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

const UNA_HORA = 60 * 60 * 1000;
const JTI_A = '00000000-0000-4000-8000-00000000000a';
const JTI_B = '00000000-0000-4000-8000-00000000000b';
const JTI_C = '00000000-0000-4000-8000-00000000000c';

let ejecutar;
let usuario;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  usuario = await sembrarUsuario(ejecutar);
});

function enUnaHora() {
  return new Date(Date.now() + UNA_HORA);
}

describe('data/sesiones', () => {
  it('insertarSesion devuelve la fila sin revocar', async () => {
    const fila = await insertarSesion(
      { jti: JTI_A, usuario_id: usuario.id, expira_en: enUnaHora() },
      ejecutar,
    );
    expect(fila.jti).toBe(JTI_A);
    expect(String(fila.usuario_id)).toBe(String(usuario.id));
    expect(fila.revocada_en).toBeNull();
  });

  it('buscarSesionVigente encuentra una sesion vigente', async () => {
    await insertarSesion({ jti: JTI_A, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);
    expect(await buscarSesionVigente(JTI_A, ejecutar)).not.toBeNull();
  });

  it('buscarSesionVigente ignora las vencidas', async () => {
    await insertarSesion(
      { jti: JTI_A, usuario_id: usuario.id, expira_en: new Date(Date.now() - 1000) },
      ejecutar,
    );
    expect(await buscarSesionVigente(JTI_A, ejecutar)).toBeNull();
  });

  it('revocarSesion la saca de las vigentes y es idempotente', async () => {
    await insertarSesion({ jti: JTI_A, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);

    expect(await revocarSesion(JTI_A, ejecutar)).toBe(1);
    expect(await buscarSesionVigente(JTI_A, ejecutar)).toBeNull();
    // Segunda vez: no afecta nada y no falla.
    expect(await revocarSesion(JTI_A, ejecutar)).toBe(0);
  });

  it('revocarSesion de un jti inexistente devuelve 0', async () => {
    expect(await revocarSesion(JTI_C, ejecutar)).toBe(0);
  });

  it('revocarSesionesDeUsuario revoca todas las del usuario y no toca las de otro', async () => {
    const otro = await sembrarUsuario(ejecutar, { email: 'otro@ejemplo.com' });
    await insertarSesion({ jti: JTI_A, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);
    await insertarSesion({ jti: JTI_B, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);
    await insertarSesion({ jti: JTI_C, usuario_id: otro.id, expira_en: enUnaHora() }, ejecutar);

    expect(await revocarSesionesDeUsuario(usuario.id, {}, ejecutar)).toBe(2);
    expect(await buscarSesionVigente(JTI_A, ejecutar)).toBeNull();
    expect(await buscarSesionVigente(JTI_B, ejecutar)).toBeNull();
    expect(await buscarSesionVigente(JTI_C, ejecutar)).not.toBeNull();
  });

  it('revocarSesionesDeUsuario con excepto deja viva esa sesion', async () => {
    await insertarSesion({ jti: JTI_A, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);
    await insertarSesion({ jti: JTI_B, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);

    expect(await revocarSesionesDeUsuario(usuario.id, { excepto: JTI_A }, ejecutar)).toBe(1);
    expect(await buscarSesionVigente(JTI_A, ejecutar)).not.toBeNull();
    expect(await buscarSesionVigente(JTI_B, ejecutar)).toBeNull();
  });

  it('borrarSesionesVencidas borra solo las vencidas hace mas de N dias', async () => {
    const hace10Dias = new Date(Date.now() - 10 * 24 * UNA_HORA);
    const hace1Dia = new Date(Date.now() - 24 * UNA_HORA);
    await insertarSesion({ jti: JTI_A, usuario_id: usuario.id, expira_en: hace10Dias }, ejecutar);
    await insertarSesion({ jti: JTI_B, usuario_id: usuario.id, expira_en: hace1Dia }, ejecutar);
    await insertarSesion({ jti: JTI_C, usuario_id: usuario.id, expira_en: enUnaHora() }, ejecutar);

    expect(await borrarSesionesVencidas(7, ejecutar)).toBe(1);
    const { rows } = await ejecutar('SELECT jti FROM sesiones');
    expect(rows.map((f) => f.jti).sort()).toEqual([JTI_B, JTI_C]);
  });
});

describe('migracion 003', () => {
  it('una cuenta nueva nace con rol usuario y estado activa (RF-06)', async () => {
    expect(usuario.rol).toBe('usuario');
    expect(usuario.estado).toBe('activa');
  });

  it('la base rechaza un rol fuera de usuario/administrador', async () => {
    await expect(
      ejecutar(`UPDATE usuarios SET rol = 'superusuario' WHERE id = $1`, [usuario.id]),
    ).rejects.toThrow();
  });

  it('la base rechaza un estado fuera de activa/bloqueada/eliminada', async () => {
    await expect(
      ejecutar(`UPDATE usuarios SET estado = 'suspendida' WHERE id = $1`, [usuario.id]),
    ).rejects.toThrow();
  });
});
