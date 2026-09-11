import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

import { registrar } from '../../src/domain/auth.js';
import { verificar as verificarToken } from '../../src/infra/jwt.js';
import { verificar as verificarContrasena } from '../../src/infra/hash.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

/** `firmar` (que usa `registrar`) lee el secreto de la config. */
beforeAll(() => prepararEntorno());
afterAll(() => limpiarEntorno());

/** Base en memoria nueva por prueba: nada de estado que se arrastre entre casos. */
let ejecutar;
beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
});

const DATOS = {
  nombre: 'Ana Diaz',
  email: 'ana@ejemplo.com',
  contrasena: 'unaclave1',
};

describe('registrar', () => {
  it('devuelve un usuario con exactamente id, nombre y email', async () => {
    const { usuario } = await registrar(DATOS, { ejecutar });

    expect(Object.keys(usuario).sort()).toEqual(['email', 'id', 'nombre']);
    expect(usuario.nombre).toBe(DATOS.nombre);
    expect(usuario.email).toBe(DATOS.email);
  });

  it('el token verifica y su id coincide con el del usuario', async () => {
    const { token, usuario } = await registrar(DATOS, { ejecutar });

    expect(verificarToken(token)).toEqual({ id: usuario.id });
  });

  it('el correo queda guardado en minusculas', async () => {
    await registrar({ ...DATOS, email: 'Ana@Ejemplo.com' }, { ejecutar });

    const { rows } = await ejecutar('SELECT email FROM usuarios');
    expect(rows[0].email).toBe('ana@ejemplo.com');
  });

  it('la base guarda un hash que verifica, distinto de la contrasena', async () => {
    await registrar(DATOS, { ejecutar });

    const { rows } = await ejecutar('SELECT contrasena_hash FROM usuarios');
    const hash = rows[0].contrasena_hash;

    expect(hash).not.toBe(DATOS.contrasena);
    expect(await verificarContrasena(DATOS.contrasena, hash)).toBe(true);
  });

  it('correo que ya tiene cuenta -> EMAIL_DUPLICADO 409', async () => {
    await registrar(DATOS, { ejecutar });

    await expect(registrar(DATOS, { ejecutar })).rejects.toMatchObject({
      codigo: 'EMAIL_DUPLICADO',
      estado: 409,
    });
  });

  it('el mismo correo con otras mayusculas -> EMAIL_DUPLICADO', async () => {
    await registrar(DATOS, { ejecutar });

    await expect(
      registrar({ ...DATOS, email: 'ANA@EJEMPLO.COM' }, { ejecutar }),
    ).rejects.toMatchObject({ codigo: 'EMAIL_DUPLICADO', estado: 409 });
  });

  it('un error de la base que no es de duplicado se propaga tal cual', async () => {
    const ejecutarQueFalla = async () => {
      throw new Error('caida');
    };

    try {
      await registrar(DATOS, { ejecutar: ejecutarQueFalla });
      expect.unreachable('se esperaba que registrar rechazara');
    } catch (error) {
      expect(error.message).toBe('caida');
      expect(error.codigo).not.toBe('EMAIL_DUPLICADO');
    }
  });
});
