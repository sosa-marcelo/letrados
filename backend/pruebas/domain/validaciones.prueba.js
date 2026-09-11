import { describe, it, expect } from 'vitest';

import {
  validarNombre,
  validarEmail,
  validarContrasena,
} from '../../src/domain/validaciones.js';

describe('validarNombre', () => {
  it('acepta un nombre válido', () => {
    expect(validarNombre('Ana').valida).toBe(true);
    expect(validarNombre('Ana').mensaje).toBe(null);
  });

  it('rechaza un nombre vacío', () => {
    expect(validarNombre('').valida).toBe(false);
    expect(validarNombre(null).valida).toBe(false);
  });

  it('rechaza un nombre de 1 carácter', () => {
    expect(validarNombre('A').valida).toBe(false);
  });

  it('rechaza un nombre de más de 80 caracteres', () => {
    expect(validarNombre('a'.repeat(81)).valida).toBe(false);
  });

  it('acepta un nombre de 80 caracteres justo', () => {
    expect(validarNombre('a'.repeat(80)).valida).toBe(true);
  });
});

describe('validarEmail', () => {
  it('acepta un correo válido', () => {
    expect(validarEmail('ana@algo.com').valida).toBe(true);
  });

  it('rechaza un correo vacío', () => {
    expect(validarEmail('').valida).toBe(false);
    expect(validarEmail(undefined).valida).toBe(false);
  });

  it('rechaza un correo sin @', () => {
    expect(validarEmail('correo-malo').valida).toBe(false);
  });

  it('rechaza un correo sin dominio', () => {
    expect(validarEmail('ana@').valida).toBe(false);
  });

  it('rechaza un correo de más de 254 caracteres', () => {
    const largo = 'a'.repeat(250) + '@x.com';
    expect(validarEmail(largo).valida).toBe(false);
  });
});

describe('validarContrasena', () => {
  it('acepta una contraseña válida', () => {
    expect(validarContrasena('abc12345').valida).toBe(true);
  });

  it('rechaza una contraseña corta', () => {
    expect(validarContrasena('abc123').valida).toBe(false);
  });

  it('rechaza una contraseña sin números', () => {
    expect(validarContrasena('abcdefgh').valida).toBe(false);
  });

  it('rechaza una contraseña sin letras', () => {
    expect(validarContrasena('12345678').valida).toBe(false);
  });

  it('rechaza una contraseña nula o vacía', () => {
    expect(validarContrasena('').valida).toBe(false);
    expect(validarContrasena(null).valida).toBe(false);
  });

  it('rechaza una contraseña de más de 72 bytes', () => {
    expect(validarContrasena('a'.repeat(73)).valida).toBe(false);
  });

  it('acepta una contraseña de 72 bytes justo', () => {
    expect(validarContrasena('a1'.repeat(36)).valida).toBe(true);
  });
});