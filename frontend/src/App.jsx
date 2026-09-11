import { createBrowserRouter } from 'react-router-dom'

import RutaProtegida from './componentes/RutaProtegida.jsx'
import RutaSinSesion from './componentes/RutaSinSesion.jsx'
import Login from './paginas/Login.jsx'
import Registro from './paginas/Registro.jsx'
import Recuperar from './paginas/Recuperar.jsx'
import ContrasenaNueva from './paginas/ContrasenaNueva.jsx'
import Home from './paginas/Home.jsx'
import Muestra from './paginas/Muestra.jsx'
import NoEncontrada from './paginas/NoEncontrada.jsx'

/*
 * Las cinco rutas del ciclo 1. Cada pantalla real la construye otra épica;
 * acá sólo va el andamio con un componente de relleno.
 *
 *   /login            Iniciar sesión            (Inicio y cierre de sesión)
 *   /registro         Crear cuenta              (Registro de cuenta)
 *   /recuperar        Solicitar recuperación    (Recuperación)
 *   /recuperar/:token Contraseña nueva          (Recuperación)
 *   /                 Home — protegida          (Inicio y cierre de sesión)
 *
 * /muestra y * no son pantallas del producto: /muestra es la vitrina
 * desechable de LET-20 y * evita la pantalla en blanco.
 *
 * Las tres pantallas de autenticación van envueltas en RutaSinSesion: con la
 * sesión abierta redirigen a Home. /recuperar/:token queda afuera, porque su
 * token de un solo uso tiene que servir aunque haya sesión en el dispositivo
 * donde se abre el enlace.
 */
export const enrutador = createBrowserRouter([
  {
    path: '/',
    element: (
      <RutaProtegida>
        <Home />
      </RutaProtegida>
    ),
  },
  {
    path: '/login',
    element: (
      <RutaSinSesion>
        <Login />
      </RutaSinSesion>
    ),
  },
  {
    path: '/registro',
    element: (
      <RutaSinSesion>
        <Registro />
      </RutaSinSesion>
    ),
  },
  {
    path: '/recuperar',
    element: (
      <RutaSinSesion>
        <Recuperar />
      </RutaSinSesion>
    ),
  },
  { path: '/recuperar/:token', element: <ContrasenaNueva /> },
  { path: '/muestra', element: <Muestra /> },
  { path: '*', element: <NoEncontrada /> },
])
