import Relleno from '../componentes/Relleno.jsx'

export default function Home() {
  return (
    <Relleno
      pantalla="Home"
      epica="Inicio y cierre de sesión"
      rutas={[
        { a: '/muestra', texto: 'Ver la muestra de componentes' },
      ]}
    />
  )
}
