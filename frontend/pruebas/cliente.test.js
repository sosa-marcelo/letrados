import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'

import { conConsulta, eliminar, escucharSesionInvalida, obtener, ErrorApi } from '../src/servicios/cliente.js'
import { esSinRed, mapearDetalles } from '../src/servicios/errores.js'

// Pruebas sin servidor ni dependencias: fetch y localStorage se reemplazan
// sólo en este proceso de Node. Ninguna operación llega a la base compartida.
const fetchOriginal = globalThis.fetch
const almacenamientoOriginal = globalThis.localStorage
let token
let avisos
let desescuchar

beforeEach(() => {
  token = 'sesion-de-prueba'
  avisos = 0
  globalThis.localStorage = {
    getItem: () => token,
    setItem: (_, nuevo) => { token = nuevo },
    removeItem: () => { token = null },
  }
  desescuchar?.()
  desescuchar = escucharSesionInvalida(() => { avisos += 1 })
})

after(() => {
  desescuchar?.()
  globalThis.fetch = fetchOriginal
  globalThis.localStorage = almacenamientoOriginal
})

function respuestaError(codigo, estado) {
  return new Response(JSON.stringify({ error: { codigo, mensaje: 'Mensaje del servidor', detalles: [] } }), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  })
}

test('un 401 SESION_INVALIDA con token avisa al contexto', async () => {
  globalThis.fetch = async () => respuestaError('SESION_INVALIDA', 401)
  await assert.rejects(obtener('/libros'), { codigo: 'SESION_INVALIDA' })
  assert.equal(avisos, 1)
})

test('una contraseña incorrecta no cierra la sesión', async () => {
  globalThis.fetch = async () => respuestaError('CONTRASENA_INCORRECTA', 401)
  await assert.rejects(obtener('/perfil'), { codigo: 'CONTRASENA_INCORRECTA' })
  assert.equal(avisos, 0)
})

test('un 401 sin token no invalida una sesión', async () => {
  token = null
  globalThis.fetch = async () => respuestaError('SESION_INVALIDA', 401)
  await assert.rejects(obtener('/libros'), ErrorApi)
  assert.equal(avisos, 0)
})

test('la respuesta tardía de otro token no cierra la sesión nueva', async () => {
  globalThis.fetch = async () => {
    token = 'otra-sesion'
    return respuestaError('SESION_INVALIDA', 401)
  }
  await assert.rejects(obtener('/libros'), ErrorApi)
  assert.equal(avisos, 0)
})

test('DELETE de perfil manda cuerpo JSON y autorización', async () => {
  globalThis.fetch = async (url, opciones) => {
    assert.equal(url, '/api/perfil')
    assert.equal(opciones.method, 'DELETE')
    assert.equal(opciones.headers.Authorization, 'Bearer sesion-de-prueba')
    assert.deepEqual(JSON.parse(opciones.body), { contrasena: 'valor-de-prueba' })
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  }
  assert.deepEqual(await eliminar('/perfil', { cuerpo: { contrasena: 'valor-de-prueba' } }), { ok: true })
})

test('un fallo de fetch se traduce a SIN_RED', async () => {
  globalThis.fetch = async () => { throw new TypeError('sin conexión') }
  await assert.rejects(obtener('/libros'), (error) => esSinRed(error) && error.codigo === 'SIN_RED')
})

test('las consultas codifican la búsqueda y omiten filtros vacíos', () => {
  assert.equal(conConsulta('/libros', { q: 'García & Borges', pagina: 2, estado: '' }), '/libros?q=Garc%C3%ADa+%26+Borges&pagina=2')
  assert.deepEqual(mapearDetalles([{ campo: 'nombre', mensaje: 'Obligatorio' }]), { nombre: 'Obligatorio' })
})
