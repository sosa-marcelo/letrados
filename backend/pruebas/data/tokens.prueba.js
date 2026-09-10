import { describe, it, expect, beforeEach } from 'vitest';

import {
  insertarToken,
  buscarTokenVigentePorHash,
  marcarTokenUsado,
  invalidarTokensPendientesDeUsuario,
} from '../../src/data/tokens.js';
import { crearBdMemoria, sembrarUsuario } from '../apoyo/bd-memoria.js';

let ejecutar;
let usuario;

const EN_UNA_HORA = () => new Date(Date.now() + 60 * 60 * 1000);
const HACE_UNA_HORA = () => new Date(Date.now() - 60 * 60 * 1000);
const hash = (n) => String(n).padStart(64, '0');

beforeEach(async () => {
  ({ ejecutar } = await crearBdMemoria());
  usuario = await sembrarUsuario(ejecutar, { email: 'dueño@ejemplo.com' });
});

describe('insertarToken', () => {
  it('inserta y devuelve la fila con usado_en en null', async () => {
    const fila = await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(1), expira_en: EN_UNA_HORA() },
      ejecutar,
    );

    expect(fila.id).toBeDefined();
    expect(fila.usuario_id).toBe(usuario.id);
    expect(fila.token_hash).toBe(hash(1));
    expect(fila.usado_en).toBeNull();
  });

  it('rechaza un usuario_id inexistente por la clave foranea', async () => {
    await expect(
      insertarToken(
        { usuario_id: 999999, token_hash: hash(2), expira_en: EN_UNA_HORA() },
        ejecutar,
      ),
    ).rejects.toThrow();
  });
});

describe('buscarTokenVigentePorHash', () => {
  it('encuentra un token no usado y sin vencer', async () => {
    await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(3), expira_en: EN_UNA_HORA() },
      ejecutar,
    );

    const fila = await buscarTokenVigentePorHash(hash(3), ejecutar);
    expect(fila).not.toBeNull();
    expect(fila.token_hash).toBe(hash(3));
  });

  it('no devuelve un token vencido', async () => {
    await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(4), expira_en: HACE_UNA_HORA() },
      ejecutar,
    );

    expect(await buscarTokenVigentePorHash(hash(4), ejecutar)).toBeNull();
  });

  it('no devuelve un token ya usado', async () => {
    const fila = await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(5), expira_en: EN_UNA_HORA() },
      ejecutar,
    );
    await marcarTokenUsado(fila.id, ejecutar);

    expect(await buscarTokenVigentePorHash(hash(5), ejecutar)).toBeNull();
  });

  it('devuelve null si el hash no existe', async () => {
    expect(await buscarTokenVigentePorHash(hash(0), ejecutar)).toBeNull();
  });
});

describe('marcarTokenUsado', () => {
  it('sella usado_en y lo saca de los vigentes', async () => {
    const fila = await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(6), expira_en: EN_UNA_HORA() },
      ejecutar,
    );

    const actualizada = await marcarTokenUsado(fila.id, ejecutar);
    expect(actualizada.usado_en).toBeInstanceOf(Date);
  });

  it('devuelve null si el id no existe', async () => {
    expect(await marcarTokenUsado(123456, ejecutar)).toBeNull();
  });

  it('hace cumplir el uso unico: el segundo marcado devuelve null', async () => {
    const fila = await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(12), expira_en: EN_UNA_HORA() },
      ejecutar,
    );

    expect(await marcarTokenUsado(fila.id, ejecutar)).not.toBeNull();
    expect(await marcarTokenUsado(fila.id, ejecutar)).toBeNull();
  });
});

describe('invalidarTokensPendientesDeUsuario', () => {
  it('invalida solo los pendientes del usuario y devuelve cuantos toco', async () => {
    await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(7), expira_en: EN_UNA_HORA() },
      ejecutar,
    );
    await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(8), expira_en: EN_UNA_HORA() },
      ejecutar,
    );
    const yaUsado = await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(9), expira_en: EN_UNA_HORA() },
      ejecutar,
    );
    await marcarTokenUsado(yaUsado.id, ejecutar);

    const cantidad = await invalidarTokensPendientesDeUsuario(usuario.id, ejecutar);

    expect(cantidad).toBe(2);
    expect(await buscarTokenVigentePorHash(hash(7), ejecutar)).toBeNull();
    expect(await buscarTokenVigentePorHash(hash(8), ejecutar)).toBeNull();
  });

  it('no toca los tokens de otro usuario', async () => {
    const otro = await sembrarUsuario(ejecutar, { email: 'otro@ejemplo.com' });
    await insertarToken(
      { usuario_id: otro.id, token_hash: hash(10), expira_en: EN_UNA_HORA() },
      ejecutar,
    );
    await insertarToken(
      { usuario_id: usuario.id, token_hash: hash(11), expira_en: EN_UNA_HORA() },
      ejecutar,
    );

    const cantidad = await invalidarTokensPendientesDeUsuario(usuario.id, ejecutar);

    expect(cantidad).toBe(1);
    expect(await buscarTokenVigentePorHash(hash(10), ejecutar)).not.toBeNull();
  });

  it('devuelve 0 si el usuario no tiene pendientes', async () => {
    expect(await invalidarTokensPendientesDeUsuario(usuario.id, ejecutar)).toBe(0);
  });
});
