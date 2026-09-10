import { describe, it, expect, beforeEach } from 'vitest';

import {
  insertarUsuario,
  buscarUsuarioPorEmail,
} from '../../src/data/usuarios.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;

beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
});

describe('insertarUsuario', () => {
  it('inserta y devuelve id, nombre, email y creado_en (sin el hash)', async () => {
    const fila = await insertarUsuario(
      { nombre: 'Ana', email: 'ana@ejemplo.com', contrasena_hash: 'h'.repeat(60) },
      ejecutar,
    );

    expect(fila.id).toBeDefined();
    expect(fila.nombre).toBe('Ana');
    expect(fila.email).toBe('ana@ejemplo.com');
    expect(fila.creado_en).toBeInstanceOf(Date);
    expect(fila).not.toHaveProperty('contrasena_hash');
  });

  it('rechaza el mismo correo escrito con mayusculas distintas', async () => {
    await insertarUsuario(
      { nombre: 'Ana', email: 'ana@ejemplo.com', contrasena_hash: 'h'.repeat(60) },
      ejecutar,
    );

    // El UNIQUE de la columna distingue mayusculas; el indice sobre lower(email)
    // de la migracion 002 es el que impide que se parta la cuenta en dos.
    await expect(
      insertarUsuario(
        { nombre: 'Ana', email: 'Ana@Ejemplo.com', contrasena_hash: 'h'.repeat(60) },
        ejecutar,
      ),
    ).rejects.toThrow();
  });

  it('deja el email duplicado en manos de la restriccion UNIQUE de la base', async () => {
    await insertarUsuario(
      { nombre: 'Ana', email: 'ana@ejemplo.com', contrasena_hash: 'h' },
      ejecutar,
    );

    await expect(
      insertarUsuario(
        { nombre: 'Otra', email: 'ana@ejemplo.com', contrasena_hash: 'x' },
        ejecutar,
      ),
    ).rejects.toThrow();
  });
});

describe('buscarUsuarioPorEmail', () => {
  it('devuelve la fila completa con contrasena_hash cuando existe', async () => {
    await sembrarUsuario(ejecutar, {
      nombre: 'Beto',
      email: 'beto@ejemplo.com',
      contrasena_hash: 'hash-secreto',
    });

    const fila = await buscarUsuarioPorEmail('beto@ejemplo.com', ejecutar);

    expect(fila).not.toBeNull();
    expect(fila.email).toBe('beto@ejemplo.com');
    expect(fila.contrasena_hash).toBe('hash-secreto');
  });

  it('devuelve null cuando no existe', async () => {
    const fila = await buscarUsuarioPorEmail('nadie@ejemplo.com', ejecutar);
    expect(fila).toBeNull();
  });

  it('no normaliza el correo: compara tal cual llega', async () => {
    await sembrarUsuario(ejecutar, { email: 'caso@ejemplo.com' });

    expect(await buscarUsuarioPorEmail('CASO@ejemplo.com', ejecutar)).toBeNull();
    expect(await buscarUsuarioPorEmail('caso@ejemplo.com', ejecutar)).not.toBeNull();
  });
});
