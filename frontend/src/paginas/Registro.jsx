import Relleno from '../componentes/Relleno.jsx'

export default function Registro() {
  return (
    <Relleno
      pantalla="Crear cuenta"
      epica="Registro de cuenta"
      rutas={[
        { a: '/login', texto: 'Iniciar sesión' },
        { a: '/recuperar', texto: 'Recuperar contraseña' },
      ]}
    />
  )
}
