import { useEffect } from 'react'
import { createBrowserRouter, Outlet, useNavigate } from 'react-router-dom'

import RutaAdmin from './componentes/RutaAdmin.jsx'
import RutaProtegida from './componentes/RutaProtegida.jsx'
import RutaSinSesion from './componentes/RutaSinSesion.jsx'
import { useSesion } from './contexto/Sesion.jsx'
import AdminCuentas from './paginas/AdminCuentas.jsx'
import AdminFlagueados from './paginas/AdminFlagueados.jsx'
import ContrasenaNueva from './paginas/ContrasenaNueva.jsx'
import Explorar from './paginas/Explorar.jsx'
import Login from './paginas/Login.jsx'
import MisLibros from './paginas/MisLibros.jsx'
import Muestra from './paginas/Muestra.jsx'
import NoEncontrada from './paginas/NoEncontrada.jsx'
import Perfil from './paginas/Perfil.jsx'
import PerfilPublico from './paginas/PerfilPublico.jsx'
import Publicacion from './paginas/Publicacion.jsx'
import Recuperar from './paginas/Recuperar.jsx'
import Registro from './paginas/Registro.jsx'
import Solicitudes from './paginas/Solicitudes.jsx'

/*
 * Mapa de navegación (DISENIO-GENERAL §9), con el módulo 4 (ciclo 3):
 *
 *   públicas
 *     /                    Explorar publicaciones (LET-132)  naranja
 *     /publicaciones/:id   Detalle de una publicación (LET-133)  naranja
 *     /usuarios/:id        Perfil público                 naranja
 *     /login /registro /recuperar /recuperar/:token       (módulo 1)
 *
 *   con sesión
 *     /mis-libros          Catálogo propio                verde
 *     /perfil              Nombre, contraseña, baja       verde
 *     /solicitudes         Recibidas y enviadas (LET-150) verde
 *
 *   administrador
 *     /admin/cuentas       Listar, buscar, bloquear       tinta
 *     /admin/flagueados    Intercambios flagueados (LET-160) tinta
 *
 * `/` es Explorar desde LET-132: pública, con o sin sesión. Hasta el ciclo 2
 * solo repartía entre /mis-libros y /login.
 *
 * /muestra y * no son pantallas del producto: /muestra es la vitrina
 * desechable de LET-20 y * evita la pantalla en blanco.
 *
 * Las tres pantallas de autenticación van envueltas en RutaSinSesion: con la
 * sesión abierta redirigen a /mis-libros. /recuperar/:token queda afuera,
 * porque su token de un solo uso tiene que servir aunque haya sesión en el
 * dispositivo donde se abre el enlace.
 */

/* También cubre las páginas públicas: una sesión revocada debe llevar a
 * /login aunque la llamada autenticada se haya hecho desde /usuarios/:id. */
function VigilarSesion() {
  const { aviso } = useSesion()
  const navigate = useNavigate()
  useEffect(() => {
    if (aviso === 'expirada') navigate('/login', { replace: true })
  }, [aviso, navigate])
  return <Outlet />
}

const rutas = [
  { path: '/', element: <Explorar /> },
  {
    path: '/mis-libros',
    element: (
      <RutaProtegida>
        <MisLibros />
      </RutaProtegida>
    ),
  },
  {
    path: '/solicitudes',
    element: (
      <RutaProtegida>
        <Solicitudes />
      </RutaProtegida>
    ),
  },
  {
    path: '/perfil',
    element: (
      <RutaProtegida>
        <Perfil />
      </RutaProtegida>
    ),
  },
  { path: '/publicaciones/:id', element: <Publicacion /> },
  { path: '/usuarios/:id', element: <PerfilPublico /> },
  {
    path: '/admin/cuentas',
    element: (
      <RutaAdmin>
        <AdminCuentas />
      </RutaAdmin>
    ),
  },
  {
    path: '/admin/flagueados',
    element: (
      <RutaAdmin>
        <AdminFlagueados />
      </RutaAdmin>
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
]

export const enrutador = createBrowserRouter([
  { element: <VigilarSesion />, children: rutas },
])
