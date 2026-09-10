import { useParams } from 'react-router-dom'

import Relleno from '../componentes/Relleno.jsx'

export default function ContrasenaNueva() {
  const { token } = useParams()
  return (
    <Relleno
      pantalla={`Contraseña nueva (token: ${token})`}
      epica="Recuperación"
      rutas={[
        { a: '/recuperar', texto: 'Solicitar recuperación' },
        { a: '/login', texto: 'Iniciar sesión' },
      ]}
    />
  )
}
