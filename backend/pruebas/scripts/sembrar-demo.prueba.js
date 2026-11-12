import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { sembrarDemo, CUENTAS } from '../../scripts/sembrar-demo.js';
import { iniciarSesion } from '../../src/domain/auth.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

const CONTRASENA = 'DemoPrueba2026';

let ejecutar;
let resultado;
const mensajes = [];
beforeAll(async () => {
  prepararEntorno();
  ({ ejecutar } = await crearBdMemoria());
  resultado = await sembrarDemo({ contrasena: CONTRASENA, ejecutar, informar: (m) => mensajes.push(m) });
});
afterAll(limpiarEntorno);

const filas = async (sql, parametros) => (await ejecutar(sql, parametros)).rows;

describe('sembrado de la demo (LET-173)', () => {
  it('crea las tres cuentas, con la administradora promovida, y entran con la contraseña', async () => {
    const cuentas = await filas(`SELECT email, rol FROM usuarios ORDER BY id`);
    expect(cuentas).toEqual([
      { email: CUENTAS.mariana.email, rol: 'usuario' },
      { email: CUENTAS.diego.email, rol: 'usuario' },
      { email: CUENTAS.admin.email, rol: 'administrador' },
    ]);
    await expect(
      iniciarSesion({ email: CUENTAS.admin.email, contrasena: CONTRASENA }, { ejecutar }),
    ).resolves.toMatchObject({ usuario: { rol: 'administrador' } });
  });

  it('seis libros y cinco publicaciones, todas con foto', async () => {
    expect(await filas(`SELECT count(*)::int AS n FROM libros`)).toEqual([{ n: 6 }]);
    const [rayuela] = await filas(`SELECT editorial, anio_publicacion, edicion, isbn, estado_conservacion, descripcion FROM libros WHERE titulo = 'Rayuela'`);
    expect(Object.values(rayuela).every((v) => v !== null)).toBe(true);
    expect(await filas(`SELECT count(*)::int AS n FROM publicaciones`)).toEqual([{ n: 5 }]);
    expect(await filas(`SELECT count(*)::int AS n FROM fotos_publicacion`)).toEqual([{ n: 5 }]);
  });

  it('un intercambio en cada estado de la presentación', async () => {
    const { completada, flagueada, pendiente } = resultado.solicitudes;
    const estado = async (id) => (await filas(`SELECT estado FROM solicitudes WHERE id = $1`, [id]))[0].estado;
    expect(await estado(completada)).toBe('completada');
    expect(await estado(flagueada)).toBe('flagueada');
    expect(await estado(pendiente)).toBe('pendiente');
  });

  it('el completado tiene las dos valoraciones y el flagueado un reporte', async () => {
    const { completada, flagueada } = resultado.solicitudes;
    expect(await filas(`SELECT puntaje FROM valoraciones WHERE solicitud_id = $1 ORDER BY puntaje`, [completada])).toEqual([
      { puntaje: 4 },
      { puntaje: 5 },
    ]);
    expect(await filas(`SELECT count(*)::int AS n FROM reportes WHERE solicitud_id = $1`, [flagueada])).toEqual([{ n: 1 }]);
  });

  it('no toca el plazo global', async () => {
    expect(await filas(`SELECT valor FROM parametros WHERE clave = 'plazo_confirmacion_segundos'`)).toEqual([
      { valor: '86400' },
    ]);
  });

  it('una segunda corrida se detiene sin escribir nada', async () => {
    const antes = await filas(`SELECT count(*)::int AS n FROM libros`);
    expect(await sembrarDemo({ contrasena: CONTRASENA, ejecutar, informar: (m) => mensajes.push(m) })).toBeNull();
    expect(await filas(`SELECT count(*)::int AS n FROM libros`)).toEqual(antes);
    expect(mensajes.at(-1)).toMatch(/ya está sembrada/);
  });
});
