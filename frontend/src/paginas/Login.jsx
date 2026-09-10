import Relleno from '../componentes/Relleno.jsx'

export default function Login() {
  return (
    <Relleno
      pantalla="Iniciar sesión"
      epica="Inicio y cierre de sesión"
      rutas={[
        { a: '/registro', texto: 'Crear cuenta' },
        { a: '/recuperar', texto: 'Recuperar contraseña' },
        { a: '/', texto: 'Home' },
      ]}
    />
  )
}
