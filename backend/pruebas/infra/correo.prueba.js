import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { enviarCorreo } from '../../src/infra/correo.js';
import { registrador } from '../../src/infra/registrador.js';
import { prepararEntorno, limpiarEntorno } from '../apoyo/entorno.js';

describe('enviarCorreo - CORREO_PROVEEDOR=consola', () => {
  beforeAll(() => prepararEntorno());
  afterAll(() => limpiarEntorno());

  let espia;
  beforeEach(() => {
    espia = vi.spyOn(registrador, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    espia.mockRestore();
  });

  it('escribe el mensaje completo una sola vez, sin salir a la red', async () => {
    await enviarCorreo({
      para: 'ana@ejemplo.com',
      asunto: 'Recupera tu contrasena',
      texto: 'Entra a http://localhost:5173/recuperar/abc123 para continuar.',
    });

    expect(espia).toHaveBeenCalledTimes(1);
    const [mensaje] = espia.mock.calls[0];
    expect(mensaje).toContain('ana@ejemplo.com');
    expect(mensaje).toContain('Recupera tu contrasena');
    // El enlace completo, no solo que se menciono un enlace.
    expect(mensaje).toContain('abc123');
  });
});

describe('enviarCorreo - otro proveedor', () => {
  beforeAll(() => prepararEntorno({ CORREO_PROVEEDOR: 'resend', CORREO_API_KEY: 'falsa' }));
  afterAll(() => prepararEntorno());

  it('rechaza con un error claro: el proveedor real todavia no esta configurado', async () => {
    await expect(
      enviarCorreo({ para: 'ana@ejemplo.com', asunto: 'x', texto: 'y' }),
    ).rejects.toThrow('El proveedor de correo real todavia no esta configurado');
  });
});
