import { describe, it, expect } from 'vitest';

import {
  ErrorDominio,
  noImplementado,
  datosInvalidos,
  rutaNoEncontrada,
  emailDuplicado,
  credencialesInvalidas,
  sesionInvalida,
} from '../../src/domain/errores.js';

describe('ErrorDominio', () => {
  it('guarda codigo, estado, mensaje y detalles', () => {
    const error = new ErrorDominio('EMAIL_DUPLICADO', 409, 'Ya existe', [
      { campo: 'email', mensaje: 'en uso' },
    ]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ErrorDominio');
    expect(error.codigo).toBe('EMAIL_DUPLICADO');
    expect(error.estado).toBe(409);
    expect(error.message).toBe('Ya existe');
    expect(error.detalles).toEqual([{ campo: 'email', mensaje: 'en uso' }]);
  });

  it('los detalles son [] por defecto', () => {
    expect(new ErrorDominio('X', 400, 'y').detalles).toEqual([]);
  });
});

describe('fabricas', () => {
  it('noImplementado -> 501 NO_IMPLEMENTADO', () => {
    const e = noImplementado();
    expect(e).toBeInstanceOf(ErrorDominio);
    expect(e.codigo).toBe('NO_IMPLEMENTADO');
    expect(e.estado).toBe(501);
  });

  it('datosInvalidos -> 400 DATOS_INVALIDOS con los detalles pasados', () => {
    const detalles = [{ campo: 'nombre', mensaje: 'obligatorio' }];
    const e = datosInvalidos(detalles);
    expect(e.codigo).toBe('DATOS_INVALIDOS');
    expect(e.estado).toBe(400);
    expect(e.detalles).toBe(detalles);
  });

  it('rutaNoEncontrada -> 404 RUTA_NO_ENCONTRADA', () => {
    const e = rutaNoEncontrada('No existe /api/x');
    expect(e.codigo).toBe('RUTA_NO_ENCONTRADA');
    expect(e.estado).toBe(404);
    expect(e.message).toBe('No existe /api/x');
  });

  it('emailDuplicado -> 409 EMAIL_DUPLICADO', () => {
    const e = emailDuplicado();
    expect(e.codigo).toBe('EMAIL_DUPLICADO');
    expect(e.estado).toBe(409);
    expect(e.message).toBe('Ya existe una cuenta con ese correo');
  });

  it('credencialesInvalidas -> 401 CREDENCIALES_INVALIDAS', () => {
    const e = credencialesInvalidas();
    expect(e.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(e.estado).toBe(401);
    expect(e.message).toBe('El correo o la contrasena no son correctos');
  });

  it('sesionInvalida -> 401 SESION_INVALIDA', () => {
    const e = sesionInvalida();
    expect(e.codigo).toBe('SESION_INVALIDA');
    expect(e.estado).toBe(401);
    expect(e.message).toBe('La sesion no es valida o expiro. Inicia sesion de nuevo.');
  });
});
