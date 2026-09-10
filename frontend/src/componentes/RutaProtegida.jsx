import { Navigate } from 'react-router-dom'

import { leerToken } from '../servicios/token.js'

/*
 * Deja pasar sólo si hay token de sesión guardado. Si no, manda a /login.
 *
 * Es una versión mínima para el andamio: la maneja de verdad (contexto de
 * sesión, refresco, expiración) la épica "Inicio y cierre de sesión".
 */
export default function RutaProtegida({ children }) {
  if (!leerToken()) {
    return <Navigate to="/login" replace />
  }
  return children
}
