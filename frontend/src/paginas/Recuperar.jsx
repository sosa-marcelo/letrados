import Relleno from '../componentes/Relleno.jsx'

export default function Recuperar() {
  return (
    <Relleno
      pantalla="Solicitar recuperación / enlace enviado"
      epica="Recuperación"
      rutas={[
        { a: '/login', texto: 'Iniciar sesión' },
        { a: '/recuperar/token-de-ejemplo', texto: 'Contraseña nueva (con token)' },
      ]}
    />
  )
}
