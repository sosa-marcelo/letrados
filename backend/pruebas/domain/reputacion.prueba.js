import { describe, it, expect } from 'vitest';

import { reputacionDe, reputacionesDe, SIN_VALORACIONES } from '../../src/domain/reputacion.js';
import { reputacionDe as reexportada } from '../../src/domain/perfil.js';

describe('reputacion (stub hasta LET-164)', () => {
  it('sin valoraciones: promedio null y cantidad 0', async () => {
    expect(await reputacionDe('1')).toEqual(SIN_VALORACIONES);
  });

  it('en lote: cada id pedido aparece en el mapa', async () => {
    const mapa = await reputacionesDe(['1', 2]);
    expect([...mapa.keys()]).toEqual(['1', '2']);
    expect(mapa.get('2')).toEqual({ promedio: null, cantidad: 0 });
  });

  it('perfil.js la sigue exportando', () => {
    expect(reexportada).toBe(reputacionDe);
  });
});
