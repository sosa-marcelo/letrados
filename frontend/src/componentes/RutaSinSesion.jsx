import { Navigate } from 'react-router-dom'

import { useSesion } from '../contexto/Sesion.jsx'

/*
 * El espejo de RutaProtegida: deja pasar sólo si NO hay sesión. Las pantallas
 * de entrar, crear cuenta y pedir recuperación no tienen sentido con la sesión
 * abierta, así que con usuario redirige a Home.
 *
 * Mientras la sesión se está resolviendo (cargando === true) no redirige ni
 * muestra nada, por el mismo motivo que RutaProtegida: el token todavía no se
 * validó contra /auth/yo y cualquier decisión acá sería un parpadeo.
 *
 * /recuperar/:token queda afuera a propósito: ese enlace lleva un token de un
 * solo uso y tiene que funcionar aunque la persona esté logueada en el
 * dispositivo donde lo abre.
 */
export default function RutaSinSesion({ children }) {
  const { usuario, cargando } = useSesion()

  if (cargando) return <div aria-hidden="true" />
  if (usuario) return <Navigate to="/" replace />
  return children
}
