import { Navigate } from 'react-router-dom'

import { esAdministrador, useSesion } from '../contexto/Sesion.jsx'

/*
 * Igual que RutaProtegida, pero además mira el rol (RF-06):
 *   - sesión resolviéndose   -> nada (evita el parpadeo)
 *   - sin sesión             -> /login
 *   - sesión sin rol admin   -> /  (que a su vez lleva a /mis-libros)
 *
 * Es una comodidad de la interfaz, no la defensa: la API igual contesta 403
 * ACCESO_DENEGADO a quien no sea administrador, y la pantalla lo maneja.
 */
export default function RutaAdmin({ children }) {
  const { usuario, cargando } = useSesion()

  if (cargando) return <div aria-hidden="true" />
  if (!usuario) return <Navigate to="/login" replace />
  if (!esAdministrador(usuario)) return <Navigate to="/" replace />
  return children
}
