import { describe, it, expect, beforeEach, vi } from 'vitest';

import { calcularVencimiento, segundosDePlazo, CLAVE_PLAZO } from '../../src/domain/plazo.js';
import { registrador } from '../../src/infra/registrador.js';
import { crearBdMemoria } from '../apoyo/bd-memoria.js';

let ejecutar;
beforeEach(async () => {
  vi.restoreAllMocks();
  ({ ejecutar } = await crearBdMemoria());
});

const plazo = (valor) => ejecutar('UPDATE parametros SET valor = $2 WHERE clave = $1', [CLAVE_PLAZO, valor]);
const AHORA = new Date('2026-11-12T10:00:00Z');

describe('plazo configurable de confirmacion (LET-154, RF-22)', () => {
  it('por defecto, 24 horas', async () => {
    expect((await calcularVencimiento(AHORA, { ejecutar })).toISOString()).toBe('2026-11-13T10:00:00.000Z');
  });

  it('con el parametro en 10, diez segundos', async () => {
    await plazo('10');
    expect((await calcularVencimiento(AHORA, { ejecutar })).toISOString()).toBe('2026-11-12T10:00:10.000Z');
  });

  it.each(['abc', '0', '-5', '1.5', ''])('un valor invalido (%j) usa 24 horas y deja un aviso', async (valor) => {
    const aviso = vi.spyOn(registrador, 'advertencia').mockImplementation(() => {});
    await plazo(valor);
    expect(await segundosDePlazo({ ejecutar })).toBe(86400);
    expect(aviso).toHaveBeenCalledOnce();
  });

  it('sin la fila del parametro, tambien 24 horas', async () => {
    vi.spyOn(registrador, 'advertencia').mockImplementation(() => {});
    await ejecutar('DELETE FROM parametros');
    expect(await segundosDePlazo({ ejecutar })).toBe(86400);
  });
});
