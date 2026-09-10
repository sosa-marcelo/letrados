import Relleno from '../componentes/Relleno.jsx'

export default function NoEncontrada() {
  return (
    <Relleno
      pantalla="404 — esa ruta no existe"
      epica="ninguna (parte del andamio)"
      rutas={[
        { a: '/login', texto: 'Iniciar sesión' },
        { a: '/', texto: 'Home' },
      ]}
    />
  )
}
