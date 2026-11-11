import { describe, it, expect } from 'vitest';

import { validarLibro, ESTADOS_CONSERVACION } from '../../src/api/validacion.js';

/** Lo minimo que pasa: los tres campos obligatorios del ciclo 2. */
const BASICO = { titulo: 'Rayuela', autor: 'Julio Cortázar', cantidad: 2 };

/** Corre la validacion y devuelve los detalles del error, o [] si paso limpio. */
function detallesDe(datos) {
  try {
    validarLibro(datos);
    return [];
  } catch (error) {
    return error.detalles;
  }
}

/** Los campos que tienen algun detalle. */
function camposConError(datos) {
  return detallesDe(datos).map((d) => d.campo);
}

describe('validarLibro - datos opcionales (LET-119)', () => {
  it('sin datos opcionales devuelve los seis en null', () => {
    expect(validarLibro(BASICO)).toEqual({
      ...BASICO,
      editorial: null,
      anio: null,
      edicion: null,
      isbn: null,
      estadoConservacion: null,
      descripcion: null,
    });
  });

  it('con todos los datos los devuelve recortados', () => {
    const datos = validarLibro({
      ...BASICO,
      editorial: '  Sudamericana ',
      anio: 1963,
      edicion: ' 1.a edición ',
      isbn: '978-950-07-0313-4',
      estadoConservacion: 'muy_bueno',
      descripcion: ' Tapa dura, sin marcas ',
    });
    expect(datos).toMatchObject({
      editorial: 'Sudamericana',
      anio: 1963,
      edicion: '1.a edición',
      isbn: '9789500703134',
      estadoConservacion: 'muy_bueno',
      descripcion: 'Tapa dura, sin marcas',
    });
  });

  it('texto vacio o solo espacios es null, no error', () => {
    const datos = validarLibro({ ...BASICO, editorial: '   ', edicion: '', descripcion: ' ' });
    expect(datos).toMatchObject({ editorial: null, edicion: null, descripcion: null });
  });

  describe('anio', () => {
    it.each([1300, 'dos mil', 1963.5, 0, -5])('%j -> detalle en anio', (anio) => {
      expect(camposConError({ ...BASICO, anio })).toEqual(['anio']);
    });

    it('un año futuro es error', () => {
      const proximo = new Date().getFullYear() + 1;
      expect(camposConError({ ...BASICO, anio: proximo })).toEqual(['anio']);
    });

    it('acepta el texto que manda un input y el año actual', () => {
      const actual = new Date().getFullYear();
      expect(validarLibro({ ...BASICO, anio: '1963' }).anio).toBe(1963);
      expect(validarLibro({ ...BASICO, anio: actual }).anio).toBe(actual);
      expect(validarLibro({ ...BASICO, anio: '' }).anio).toBeNull();
    });
  });

  describe('isbn', () => {
    it.each(['978950070313', '97895007031345', '95007031X3', 'abcdefghij', 9789500703134])(
      '%j -> detalle en isbn',
      (isbn) => {
        expect(camposConError({ ...BASICO, isbn })).toEqual(['isbn']);
      },
    );

    it('normaliza guiones, espacios y la x final', () => {
      expect(validarLibro({ ...BASICO, isbn: '978-950-07-0313-4' }).isbn).toBe('9789500703134');
      expect(validarLibro({ ...BASICO, isbn: '0 306 40615 2' }).isbn).toBe('0306406152');
      expect(validarLibro({ ...BASICO, isbn: '0-8044-2957-x' }).isbn).toBe('080442957X');
    });
  });

  describe('estadoConservacion', () => {
    it.each(ESTADOS_CONSERVACION)('acepta %s', (estado) => {
      expect(validarLibro({ ...BASICO, estadoConservacion: estado }).estadoConservacion).toBe(estado);
    });

    it.each(['roto', 'Nuevo', 3])('%j -> detalle en estadoConservacion', (estado) => {
      expect(camposConError({ ...BASICO, estadoConservacion: estado })).toEqual([
        'estadoConservacion',
      ]);
    });
  });

  it('textos largos: editorial > 120, edicion > 60, descripcion > 500', () => {
    expect(
      camposConError({
        ...BASICO,
        editorial: 'e'.repeat(121),
        edicion: 'e'.repeat(61),
        descripcion: 'd'.repeat(501),
      }),
    ).toEqual(['editorial', 'edicion', 'descripcion']);
  });

  it('un texto que no es string es error en su campo', () => {
    expect(camposConError({ ...BASICO, editorial: 42 })).toEqual(['editorial']);
  });

  it('junta los errores de obligatorios y opcionales en una sola respuesta', () => {
    expect(camposConError({ titulo: '', autor: 'A', cantidad: 0, anio: 1300, isbn: '1' })).toEqual([
      'titulo',
      'cantidad',
      'anio',
      'isbn',
    ]);
  });
});
