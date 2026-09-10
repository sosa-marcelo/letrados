import { createBrowserRouter } from 'react-router-dom'

import RutaProtegida from './componentes/RutaProtegida.jsx'
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
  { path: '/login', element: <Login /> },
  { path: '/registro', element: <Registro /> },
  { path: '/recuperar', element: <Recuperar /> },
  { path: '/recuperar/:token', element: <ContrasenaNueva /> },
  { path: '/muestra', element: <Muestra /> },
  { path: '*', element: <NoEncontrada /> },
])
