import { describe, it, expect } from 'vitest';
import { hashear, verificar } from '../../src/infra/hash.js';

describe('hash', () => {
  it('la misma contrasena verifica', async () => {
    const hash = await hashear('unaclave1');
    expect(await verificar('unaclave1', hash)).toBe(true);
  });

  it('otra contrasena no verifica', async () => {
    const hash = await hashear('unaclave1');
    expect(await verificar('otraclave1', hash)).toBe(false);
  });

  it('el hash no es igual a la contrasena', async () => {
    const contrasena = 'unaclave1';
    const hash = await hashear(contrasena);

    expect(hash).not.toBe(contrasena);
  });

  it('dos hashes de la misma contrasena son distintos y ambos verifican', async () => {
    const contrasena = 'unaclave1';

    const hash1 = await hashear(contrasena);
    const hash2 = await hashear(contrasena);

    expect(hash1).not.toBe(hash2);
    expect(await verificar(contrasena, hash1)).toBe(true);
    expect(await verificar(contrasena, hash2)).toBe(true);
  });

  it('el hash mide 60 caracteres', async () => {
    const hash = await hashear('unaclave1');

    expect(hash).toHaveLength(60);
  });

});