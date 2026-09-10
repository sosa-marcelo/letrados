import { describe, it, expect, vi, afterEach } from 'vitest';

import { redactar, registrador } from '../../src/infra/registrador.js';

describe('redactar', () => {
  it('enmascara claves sensibles a cualquier profundidad', () => {
    const entrada = {
      email: 'ana@x.com',
      contrasena: 'secreta',
      cuerpo: { token: 'abc.def.ghi', nota: 'ok' },
      lista: [{ contrasena_hash: '$2b$...' }],
    };

    expect(redactar(entrada)).toEqual({
      email: 'ana@x.com',
      contrasena: '[redactado]',
      cuerpo: { token: '[redactado]', nota: 'ok' },
      lista: [{ contrasena_hash: '[redactado]' }],
    });
  });

  it('no muta el original', () => {
    const entrada = { contrasena: 'secreta' };
    redactar(entrada);
    expect(entrada.contrasena).toBe('secreta');
  });

  it('compara la clave sin distinguir mayusculas', () => {
    expect(redactar({ Authorization: 'Bearer x' })).toEqual({
      Authorization: '[redactado]',
    });
  });

  it('deja pasar valores primitivos', () => {
    expect(redactar('hola')).toBe('hola');
    expect(redactar(42)).toBe(42);
    expect(redactar(null)).toBeNull();
  });
});

describe('registrador', () => {
  afterEach(() => vi.restoreAllMocks());

  it('redacta antes de escribir en console', () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});

    registrador.error('fallo', { contrasena: 'secreta', ruta: '/api/login' });

    expect(espia).toHaveBeenCalledWith('fallo', {
      contrasena: '[redactado]',
      ruta: '/api/login',
    });
  });
});
