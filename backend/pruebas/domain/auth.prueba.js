import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

import { registrar, iniciarSesion, usuarioActual } from '../../src/domain/auth.js';
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

describe('iniciarSesion', () => {
  it('login correcto -> token y usuario con exactamente id, nombre y email', async () => {
    await registrar(DATOS, { ejecutar });

    const { token, usuario } = await iniciarSesion(
      { email: DATOS.email, contrasena: DATOS.contrasena },
      { ejecutar },
    );

    expect(Object.keys(usuario).sort()).toEqual(['email', 'id', 'nombre']);
    expect(verificarToken(token)).toEqual({ id: usuario.id });
  });

  it('correo con otras mayusculas y espacios alrededor -> entra igual', async () => {
    await registrar(DATOS, { ejecutar });

    const { usuario } = await iniciarSesion(
      { email: `  ${DATOS.email.toUpperCase()}  `, contrasena: DATOS.contrasena },
      { ejecutar },
    );

    expect(usuario.email).toBe(DATOS.email);
  });

  it('contrasena incorrecta -> CREDENCIALES_INVALIDAS 401', async () => {
    await registrar(DATOS, { ejecutar });

    await expect(
      iniciarSesion({ email: DATOS.email, contrasena: 'otra-contrasena' }, { ejecutar }),
    ).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS', estado: 401 });
  });

  it('correo inexistente -> mismo codigo, estado y mensaje que contrasena incorrecta', async () => {
    await registrar(DATOS, { ejecutar });

    let errorContrasena;
    try {
      await iniciarSesion({ email: DATOS.email, contrasena: 'otra-contrasena' }, { ejecutar });
    } catch (error) {
      errorContrasena = error;
    }

    let errorInexistente;
    try {
      await iniciarSesion({ email: 'nadie@ejemplo.com', contrasena: 'lo-que-sea' }, { ejecutar });
    } catch (error) {
      errorInexistente = error;
    }

    expect(errorInexistente.codigo).toBe(errorContrasena.codigo);
    expect(errorInexistente.estado).toBe(errorContrasena.estado);
    expect(errorInexistente.message).toBe(errorContrasena.message);
  });

  it(
    'correo inexistente tarda al menos 100ms: se ejecuta la comparacion ficticia',
    async () => {
      const inicio = performance.now();

      await expect(
        iniciarSesion({ email: 'nadie@ejemplo.com', contrasena: 'lo-que-sea' }, { ejecutar }),
      ).rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' });

      const duracion = performance.now() - inicio;
      // Sin comparar contra HASH_FICTICIO esto tarda ~1ms; con bcrypt de coste
      // 12 de verdad, bastante mas de 100ms.
      expect(duracion).toBeGreaterThanOrEqual(100);
    },
    10_000,
  );
});

describe('usuarioActual', () => {
  it('id existente -> id, nombre y email exactos', async () => {
    const { usuario } = await registrar(DATOS, { ejecutar });

    const actual = await usuarioActual(usuario.id, { ejecutar });

    expect(actual).toEqual({ id: usuario.id, nombre: DATOS.nombre, email: DATOS.email });
  });

  it('id inexistente -> SESION_INVALIDA 401', async () => {
    await expect(usuarioActual('999999', { ejecutar })).rejects.toMatchObject({
      codigo: 'SESION_INVALIDA',
      estado: 401,
    });
  });
});
