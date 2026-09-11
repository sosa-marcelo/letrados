import { describe, it, expect } from 'vitest';

import {
  validarRegistro,
  validarConfirmacionRecuperacion,
} from '../../src/api/validacion.js';

/** Corre la validacion y devuelve los detalles del error, o [] si paso limpio. */
function detallesDe(datos) {
  try {
    validarRegistro(datos);
    return [];
  } catch (error) {
    return error.detalles;
  }
}

/** Datos que pasan todas las reglas; cada prueba cambia solo lo que quiere probar. */
const VALIDOS = {
  nombre: 'Ana Diaz',
  email: 'ana@ejemplo.com',
  contrasena: 'unaclave1',
};

/** Igual que la anterior, para las pruebas de la contrasena nueva. */
function detallesDeConfirmar(datos) {
  try {
    validarConfirmacionRecuperacion(datos);
    return [];
  } catch (error) {
    return error.detalles;
  }
}

const CONFIRMACION_OK = {
  token: 'un-token',
  contrasena: 'unaclave1',
};

describe('validarRegistro - reglas de la contrasena', () => {
  it('7 caracteres falla y 8 pasan', () => {
    const corta = detallesDe({ ...VALIDOS, contrasena: 'unacla1' }).map((d) => d.campo);
    expect(corta).toContain('contrasena');

    const justa = detallesDe({ ...VALIDOS, contrasena: 'unaclave1' });
    expect(justa).toEqual([]);
  });

  it('sin ningun numero falla', () => {
    const campos = detallesDe({ ...VALIDOS, contrasena: 'sololetras' }).map((d) => d.campo);
    expect(campos).toContain('contrasena');
  });

  it('sin ninguna letra falla', () => {
    const campos = detallesDe({ ...VALIDOS, contrasena: '12345678' }).map((d) => d.campo);
    expect(campos).toContain('contrasena');
  });

  it('72 bytes pasan y 73 fallan', () => {
    const justa = detallesDe({ ...VALIDOS, contrasena: 'a1' + 'x'.repeat(70) });
    expect(justa).toEqual([]);

    const pasada = detallesDe({ ...VALIDOS, contrasena: 'a1' + 'x'.repeat(71) }).map(
      (d) => d.campo,
    );
    expect(pasada).toContain('contrasena');
  });
});

describe('validarRegistro - reglas que ya andaban (fijadas de paso)', () => {
  it('nombre vacio falla y nombre de 80 pasa', () => {
    const vacio = detallesDe({ ...VALIDOS, nombre: '' }).map((d) => d.campo);
    expect(vacio).toContain('nombre');

    const justa = detallesDe({ ...VALIDOS, nombre: 'a'.repeat(80) });
    expect(justa).toEqual([]);
  });

  it('nombre de 81 falla', () => {
    const campos = detallesDe({ ...VALIDOS, nombre: 'a'.repeat(81) }).map((d) => d.campo);
    expect(campos).toContain('nombre');
  });

  it('correo sin arroba falla', () => {
    const campos = detallesDe({ ...VALIDOS, email: 'correo-sin-arroba' }).map(
      (d) => d.campo,
    );
    expect(campos).toContain('email');
  });
});

describe('validarConfirmacionRecuperacion - mismas reglas de contrasena', () => {
  it('7 caracteres falla y 8 pasan', () => {
    const corta = detallesDeConfirmar({ ...CONFIRMACION_OK, contrasena: 'unacla1' }).map(
      (d) => d.campo,
    );
    expect(corta).toContain('contrasena');

    const justa = detallesDeConfirmar({ ...CONFIRMACION_OK, contrasena: 'unaclave1' });
    expect(justa).toEqual([]);
  });

  it('sin ningun numero falla', () => {
    const campos = detallesDeConfirmar({
      ...CONFIRMACION_OK,
      contrasena: 'sololetras',
    }).map((d) => d.campo);
    expect(campos).toContain('contrasena');
  });

  it('sin ninguna letra falla', () => {
    const campos = detallesDeConfirmar({
      ...CONFIRMACION_OK,
      contrasena: '12345678',
    }).map((d) => d.campo);
    expect(campos).toContain('contrasena');
  });

  it('72 bytes pasan y 73 fallan', () => {
    const justa = detallesDeConfirmar({
      ...CONFIRMACION_OK,
      contrasena: 'a1' + 'x'.repeat(70),
    });
    expect(justa).toEqual([]);

    const pasada = detallesDeConfirmar({
      ...CONFIRMACION_OK,
      contrasena: 'a1' + 'x'.repeat(71),
    }).map((d) => d.campo);
    expect(pasada).toContain('contrasena');
  });

  it('datos validos pasan limpios', () => {
    expect(detallesDeConfirmar(CONFIRMACION_OK)).toEqual([]);
  });
});