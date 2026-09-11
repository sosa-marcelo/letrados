import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { obtener, ErrorApi } from '../servicios/cliente.js'
import { borrarToken, guardarToken, leerToken } from '../servicios/token.js'

/*
 * Contexto de sesión: quién está logueado, y las dos acciones para cambiarlo.
 *
 * Al montar, si hay token guardado, pide GET /auth/yo para recuperar al
 * usuario; mientras tanto `cargando` es true. Si la API contesta 401, el
 * token ya no sirve: se borra y el usuario queda en null. Si falla por
 * cualquier otro motivo (sin red, servidor caído, el 501 de hoy porque el
 * dominio no está escrito), el token se deja como está y el usuario queda en
 * null — un servidor caído no es una sesión inválida.
 */
const ContextoSesion = createContext(null)

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(() => Boolean(leerToken()))

  useEffect(() => {
    if (!leerToken()) return

    let cancelado = false

    obtener('/auth/yo')
      .then((datos) => {
        if (!cancelado) setUsuario(datos?.usuario ?? null)
      })
      .catch((error) => {
        if (cancelado) return
        if (error instanceof ErrorApi && error.estado === 401) borrarToken()
        setUsuario(null)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [])

  const entrar = useCallback((token, usuarioNuevo) => {
    guardarToken(token)
    setUsuario(usuarioNuevo)
  }, [])

  const salir = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  return (
    <ContextoSesion.Provider value={{ usuario, cargando, entrar, salir }}>
      {children}
    </ContextoSesion.Provider>
  )
}

/** @returns {{ usuario: object|null, cargando: boolean, entrar: (token: string, usuario: object) => void, salir: () => void }} */
export function useSesion() {
  const contexto = useContext(ContextoSesion)
  if (!contexto) {
    throw new Error('useSesion() se tiene que usar dentro de <ProveedorSesion>.')
  }
  return contexto
}
