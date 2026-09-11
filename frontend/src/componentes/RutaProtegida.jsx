import { Navigate } from 'react-router-dom'

import { useSesion } from '../contexto/Sesion.jsx'

/*
 * Deja pasar sólo si el contexto de sesión tiene un usuario. Mientras la
 * sesión todavía se está resolviendo (cargando === true) no redirige ni
 * muestra nada — evita un parpadeo a /login antes de saber si el token vale.
 * Si termina de cargar y no hay usuario, manda a /login.
 */
export default function RutaProtegida({ children }) {
  const { usuario, cargando } = useSesion()

  if (cargando) return <div aria-hidden="true" />
  if (!usuario) return <Navigate to="/login" replace />
  return children
}
