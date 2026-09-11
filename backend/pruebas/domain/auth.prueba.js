import { createHash } from 'node:crypto';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

import {
  registrar,
  iniciarSesion,
  usuarioActual,
  pedirRecuperacion,
  confirmarRecuperacion,
} from '../../src/domain/auth.js';
import { verificar as verificarToken } from '../../src/infra/jwt.js';
import { verificar as verificarContrasena } from '../../src/infra/hash.js';
import { obtenerConfig } from '../../src/infra/config.js';
import { insertarToken } from '../../src/data/tokens.js';
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

/**
 * Pide una recuperacion de verdad (via `pedirRecuperacion`) y devuelve el
 * token en claro, sacado del enlace que le llego a `enviar`.
 */
async function generarTokenDeRecuperacion(email = DATOS.email) {
  const enviar = crearEnviarFalso();
  await pedirRecuperacion({ email }, { ejecutar, enviar });

  const { urlFrontend } = obtenerConfig();
  const patron = new RegExp(
    `${urlFrontend.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/recuperar/([^\\s]+)`,
  );
  const [, token] = enviar.llamadas[0].texto.match(patron);
  return token;
}

describe('confirmarRecuperacion', () => {
  it('token valido -> la contrasena guardada verifica con la nueva, ya no con la vieja', async () => {
    const { usuario } = await registrar(DATOS, { ejecutar });
    const token = await generarTokenDeRecuperacion();
    const contrasenaNueva = 'otraclave2';

    await confirmarRecuperacion({ token, contrasena: contrasenaNueva }, { ejecutar });

    const { rows } = await ejecutar(
      'SELECT contrasena_hash FROM usuarios WHERE id = $1',
      [usuario.id],
    );
    const hash = rows[0].contrasena_hash;

    expect(await verificarContrasena(contrasenaNueva, hash)).toBe(true);
    expect(await verificarContrasena(DATOS.contrasena, hash)).toBe(false);
  });

  it('el token usado queda con usado_en sellado', async () => {
    await registrar(DATOS, { ejecutar });
    const token = await generarTokenDeRecuperacion();

    await confirmarRecuperacion({ token, contrasena: 'otraclave2' }, { ejecutar });

    const [fila] = await filasDeTokens();
    expect(fila.usado_en).not.toBeNull();
  });

  it('el mismo token dos veces -> la segunda vez TOKEN_INVALIDO 400', async () => {
    await registrar(DATOS, { ejecutar });
    const token = await generarTokenDeRecuperacion();

    await confirmarRecuperacion({ token, contrasena: 'otraclave2' }, { ejecutar });

    await expect(
      confirmarRecuperacion({ token, contrasena: 'unaterceraclave3' }, { ejecutar }),
    ).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO', estado: 400 });
  });

  it('token inexistente -> TOKEN_INVALIDO', async () => {
    await expect(
      confirmarRecuperacion(
        { token: 'esto-no-es-un-token-real', contrasena: 'unaclave2' },
        { ejecutar },
      ),
    ).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO', estado: 400 });
  });

  it('token vencido -> TOKEN_INVALIDO', async () => {
    const { usuario } = await registrar(DATOS, { ejecutar });
    const tokenVencido = 'token-de-prueba-que-ya-vencio';

    await insertarToken(
      {
        usuario_id: usuario.id,
        token_hash: createHash('sha256').update(tokenVencido).digest('hex'),
        expira_en: new Date(Date.now() - 60_000), // vencio hace un minuto
      },
      ejecutar,
    );

    await expect(
      confirmarRecuperacion({ token: tokenVencido, contrasena: 'unaclave2' }, { ejecutar }),
    ).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO', estado: 400 });
  });

  it('si el usuario tenia otro enlace pendiente, queda invalidado al terminar', async () => {
    const { usuario } = await registrar(DATOS, { ejecutar });
    const token = await generarTokenDeRecuperacion();

    // Otro enlace pendiente para el mismo usuario, insertado directo (no via
    // pedirRecuperacion, que ya lo hubiera invalidado antes de crear `token`).
    const otroTokenHash = createHash('sha256').update('otro-enlace-pendiente').digest('hex');
    await insertarToken(
      {
        usuario_id: usuario.id,
        token_hash: otroTokenHash,
        expira_en: new Date(Date.now() + 30 * 60 * 1000),
      },
      ejecutar,
    );

    await confirmarRecuperacion({ token, contrasena: 'otraclave2' }, { ejecutar });

    const filaOtro = (await filasDeTokens()).find((f) => f.token_hash === otroTokenHash);
    expect(filaOtro.usado_en).not.toBeNull();
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
