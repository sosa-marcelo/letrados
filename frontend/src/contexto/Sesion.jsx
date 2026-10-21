import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { obtener, enviar, ErrorApi, escucharSesionInvalida } from '../servicios/cliente.js'
import { borrarToken, guardarToken, leerToken } from '../servicios/token.js'

/*
 * Contexto de sesión: quién está logueado, y las acciones para cambiarlo.
 *
 * Al montar, si hay token guardado, pide GET /auth/yo para recuperar al
 * usuario; mientras tanto `cargando` es true. Si la API contesta 401, el
 * token ya no sirve: se borra y el usuario queda en null. Si falla por
 * cualquier otro motivo (sin red, servidor caído), el token se deja como está
 * y el usuario queda en null — un servidor caído no es una sesión inválida.
 *
 * El usuario trae { id, nombre, email, rol }. `rol` es 'usuario' o
 * 'administrador' y decide si la barra muestra «Administración» y si
 * RutaAdmin deja pasar.
 *
 * `aviso` es un mensaje que sobrevive a la redirección a /login: lo deja
 * `olvidarSesion` y lo muestra Login. Va en el contexto y no en el state de
 * la navegación porque, al quedar el usuario en null, RutaProtegida redirige
 * por su cuenta y esa navegación le ganaría a la nuestra.
 *   'baja'      la cuenta se dio de baja      -> «Tu cuenta fue eliminada.»
 *   'expirada'  la API dijo SESION_INVALIDA   -> «Tu sesión se cerró…»
 */
const ContextoSesion = createContext(null)

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(() => Boolean(leerToken()))
  const [aviso, setAviso] = useState(null)

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
    setAviso(null)
    setUsuario(usuarioNuevo)
  }, [])

  // RF-03: primero se avisa al servidor (POST /auth/logout revoca la sesión)
  // y después se olvida el token. Si el aviso falla (sin red, sesión ya
  // vencida), igual se cierra del lado del cliente: el usuario pidió salir.
  const salir = useCallback(async () => {
    if (leerToken()) {
      try {
        await enviar('/auth/logout')
      } catch {
        /* el token se borra igual */
      }
    }
    borrarToken()
    setAviso(null)
    setUsuario(null)
  }, [])

  // Cierra la sesión SIN avisar al servidor: para cuando el servidor ya la
  // revocó (baja de cuenta, 401 SESION_INVALIDA). Llamar a /auth/logout ahí
  // sólo devolvería otro 401.
  const olvidarSesion = useCallback((motivo = null) => {
    borrarToken()
    setAviso(motivo)
    setUsuario(null)
  }, [])

  // Cambios parciales del usuario en memoria (p. ej. el nombre nuevo después
  // de PUT /api/perfil), para que la barra no siga mostrando el viejo.
  const actualizarUsuario = useCallback((cambios) => {
    setUsuario((actual) => (actual ? { ...actual, ...cambios } : actual))
  }, [])

  const descartarAviso = useCallback(() => setAviso(null), [])

  // Cualquier 401 SESION_INVALIDA de una llamada con token cierra la sesión
  // en todas las pantallas: RutaProtegida ve el usuario en null y manda a
  // /login, donde aparece el aviso de sesión vencida.
  useEffect(
    () =>
      escucharSesionInvalida(() => {
        borrarToken()
        setAviso((actual) => actual ?? 'expirada')
        setUsuario(null)
      }),
    [],
  )

  return (
    <ContextoSesion.Provider
      value={{
        usuario,
        cargando,
        aviso,
        entrar,
        salir,
        olvidarSesion,
        actualizarUsuario,
        descartarAviso,
      }}
    >
      {children}
    </ContextoSesion.Provider>
  )
}

/**
 * @returns {{
 *   usuario: { id: string, nombre: string, email: string, rol: string } | null,
 *   cargando: boolean,
 *   aviso: 'baja' | 'expirada' | null,
 *   entrar: (token: string, usuario: object) => void,
 *   salir: () => Promise<void>,
 *   olvidarSesion: (motivo?: 'baja' | 'expirada' | null) => void,
 *   actualizarUsuario: (cambios: object) => void,
 *   descartarAviso: () => void,
 * }}
 */
export function useSesion() {
  const contexto = useContext(ContextoSesion)
  if (!contexto) {
    throw new Error('useSesion() se tiene que usar dentro de <ProveedorSesion>.')
  }
  return contexto
}

/** true si el usuario de la sesión es administrador (RF-06). */
export function esAdministrador(usuario) {
  return usuario?.rol === 'administrador'
}
