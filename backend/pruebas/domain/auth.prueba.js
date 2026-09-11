import { createHash } from 'node:crypto';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

import { registrar, pedirRecuperacion } from '../../src/domain/auth.js';
import { verificar as verificarToken } from '../../src/infra/jwt.js';
import { verificar as verificarContrasena } from '../../src/infra/hash.js';
import { obtenerConfig } from '../../src/infra/config.js';
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

/** `enviar` falso: anota cada llamada en `llamadas` en vez de mandar nada. */
function crearEnviarFalso() {
  const llamadas = [];
  const enviar = async (mensaje) => {
    llamadas.push(mensaje);
  };
  enviar.llamadas = llamadas;
  return enviar;
}

/** Filas de `tokens_recuperacion`, ordenadas por `creado_en`. */
async function filasDeTokens() {
  const { rows } = await ejecutar(
    'SELECT * FROM tokens_recuperacion ORDER BY creado_en',
  );
  return rows;
}

describe('pedirRecuperacion', () => {
  it('correo inexistente -> resuelve, no inserta token, no llama a enviar', async () => {
    const enviar = crearEnviarFalso();

    await expect(
      pedirRecuperacion({ email: 'nadie@ejemplo.com' }, { ejecutar, enviar }),
    ).resolves.toBeUndefined();

    expect(await filasDeTokens()).toHaveLength(0);
    expect(enviar.llamadas).toHaveLength(0);
  });

  it('correo existente -> queda un token vigente y se llama a enviar una vez', async () => {
    await registrar(DATOS, { ejecutar });
    const enviar = crearEnviarFalso();
    const antes = Date.now();

    await pedirRecuperacion({ email: DATOS.email }, { ejecutar, enviar });

    const filas = await filasDeTokens();
    expect(filas).toHaveLength(1);
    expect(filas[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(filas[0].usado_en).toBeNull();

    // "unos 30 minutos": un margen chico para el tiempo que pasa entre medir
    // `antes` y que pedirRecuperacion calcule su propio Date.now() interno.
    const minutosHastaVencer = (new Date(filas[0].expira_en) - antes) / 60_000;
    expect(minutosHastaVencer).toBeGreaterThan(29);
    expect(minutosHastaVencer).toBeLessThanOrEqual(30.1);

    expect(enviar.llamadas).toHaveLength(1);
    expect(enviar.llamadas[0].para).toBe(DATOS.email);
  });

  it('el enlace del texto trae el token en claro; su SHA-256 es el guardado', async () => {
    await registrar(DATOS, { ejecutar });
    const enviar = crearEnviarFalso();

    await pedirRecuperacion({ email: DATOS.email }, { ejecutar, enviar });

    const { urlFrontend } = obtenerConfig();
    const patron = new RegExp(
      `${urlFrontend.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/recuperar/([^\\s]+)`,
    );
    const coincidencia = enviar.llamadas[0].texto.match(patron);
    expect(coincidencia).not.toBeNull();

    const [, token] = coincidencia;
    const [{ token_hash: tokenHashGuardado }] = await filasDeTokens();

    expect(createHash('sha256').update(token).digest('hex')).toBe(tokenHashGuardado);
    expect(tokenHashGuardado).not.toBe(token);
  });

  it('pedirla dos veces seguidas: solo el segundo token queda vigente', async () => {
    await registrar(DATOS, { ejecutar });
    const enviar = crearEnviarFalso();

    await pedirRecuperacion({ email: DATOS.email }, { ejecutar, enviar });
    const [primero] = await filasDeTokens();

    await pedirRecuperacion({ email: DATOS.email }, { ejecutar, enviar });
    const filas = await filasDeTokens();

    expect(filas).toHaveLength(2);
    const actualizado = filas.find((f) => f.id === primero.id);
    const segundo = filas.find((f) => f.id !== primero.id);

    expect(actualizado.usado_en).not.toBeNull(); // invalidado, no borrado
    expect(segundo.usado_en).toBeNull();
  });

  it('correo con otras mayusculas y espacios alrededor -> encuentra al usuario igual', async () => {
    await registrar(DATOS, { ejecutar });
    const enviar = crearEnviarFalso();

    await pedirRecuperacion(
      { email: `  ${DATOS.email.toUpperCase()}  ` },
      { ejecutar, enviar },
    );

    expect(await filasDeTokens()).toHaveLength(1);
    expect(enviar.llamadas).toHaveLength(1);
  });

  it('si enviar lanza, pedirRecuperacion resuelve igual, sin propagar', async () => {
    await registrar(DATOS, { ejecutar });
    const enviarQueFalla = async () => {
      throw new Error('no se pudo mandar');
    };

    await expect(
      pedirRecuperacion({ email: DATOS.email }, { ejecutar, enviar: enviarQueFalla }),
    ).resolves.toBeUndefined();

    // El token ya se habia insertado antes del intento de envio.
    expect(await filasDeTokens()).toHaveLength(1);
  });
});
