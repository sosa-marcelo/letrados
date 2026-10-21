import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { esAdministrador, useSesion } from '../contexto/Sesion.jsx'
import Chip from './Chip.jsx'
import { IconoCerrar, IconoFlechaAbajo, IconoMenu } from './Iconos.jsx'
import './Barra.css'

/*
 * Navegación superior del Marco. Tinta, 64 px (56 a ≤479 px). No recibe
 * props: lee la sesión.
 *
 * Con sesión:
 *   marca · Mis libros · Perfil · Administración (sólo administradores)
 *   … a la derecha la marca «Admin» si corresponde y el botón de cuenta
 *   (inicial + nombre) que abre un menú con «Tu perfil público» y «Cerrar
 *   sesión».
 * Sin sesión (p. ej. un visitante en /usuarios/:id):
 *   marca · «Entrar» y «Crear cuenta».
 *
 * La sección activa lleva un subrayado naranja de 2 px, nunca un fondo: el
 * fondo la confundiría con un botón.
 *
 * A ≤479 px la navegación colapsa en un menú (hamburguesa) que se despliega
 * debajo de la barra, con la cuenta y «Cerrar sesión» al final.
 */
export default function Barra() {
  const { usuario, salir } = useSesion()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const cuentaRef = useRef(null)

  const admin = esAdministrador(usuario)
  const nombre = usuario?.nombre ?? ''
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?'

  // Al navegar se cierran los dos menús.
  useEffect(() => {
    setMenuAbierto(false)
    setCuentaAbierta(false)
  }, [pathname])

  // El menú de cuenta se cierra con Esc o con un clic afuera.
  useEffect(() => {
    if (!cuentaAbierta && !menuAbierto) return undefined
    function alTeclear(e) {
      if (e.key === 'Escape') {
        setCuentaAbierta(false)
        setMenuAbierto(false)
      }
    }
    function alTocar(e) {
      if (cuentaRef.current && !cuentaRef.current.contains(e.target)) setCuentaAbierta(false)
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('mousedown', alTocar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('mousedown', alTocar)
    }
  }, [cuentaAbierta, menuAbierto])

  async function alSalir() {
    await salir()
    navigate('/login')
  }

  const claseEnlace = ({ isActive }) => `barra__enlace ${isActive ? 'barra__enlace--activo' : ''}`.trim()

  const enlaces = usuario && (
    <>
      <NavLink to="/mis-libros" className={claseEnlace}>
        Mis libros
      </NavLink>
      <NavLink to="/perfil" className={claseEnlace}>
        Perfil
      </NavLink>
      {admin && (
        <NavLink to="/admin/cuentas" className={claseEnlace}>
          Administración
        </NavLink>
      )}
    </>
  )

  return (
    <header className={`barra ${pathname.startsWith('/admin') ? 'barra--admin' : ''}`.trim()}>
      <div className="barra__izq">
        <Link to="/" className="barra__marca">
          Letrados
        </Link>
        {usuario && (
          <nav className="barra__nav" aria-label="Secciones">
            {enlaces}
          </nav>
        )}
      </div>

      <div className="barra__der">
        {usuario ? (
          <>
            {admin && (
              <span className="barra__solo-ancho">
                <Chip estado="administrador" />
              </span>
            )}
            <div className="barra__cuenta barra__solo-ancho" ref={cuentaRef}>
              <button
                type="button"
                className="barra__boton-cuenta"
                aria-haspopup="menu"
                aria-expanded={cuentaAbierta}
                aria-controls="barra-menu-cuenta"
                onClick={() => setCuentaAbierta((v) => !v)}
              >
                <span className="barra__avatar" aria-hidden="true">
                  {inicial}
                </span>
                <span className="barra__nombre">{nombre}</span>
                <IconoFlechaAbajo />
              </button>
              {cuentaAbierta && (
                <div id="barra-menu-cuenta" className="barra__menu-cuenta" role="menu">
                  <Link role="menuitem" to={`/usuarios/${usuario.id}`} className="barra__item">
                    Tu perfil público
                  </Link>
                  <button role="menuitem" type="button" className="barra__item" onClick={alSalir}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="barra__hamburguesa"
              aria-expanded={menuAbierto}
              aria-controls="barra-menu-movil"
              aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
              onClick={() => setMenuAbierto((v) => !v)}
            >
              {menuAbierto ? <IconoCerrar /> : <IconoMenu />}
            </button>
          </>
        ) : (
          <div className="barra__visitante">
            <Link to="/login" className="barra__enlace">
              Entrar
            </Link>
            <Link to="/registro" className="barra__crear">
              Crear cuenta
            </Link>
          </div>
        )}
      </div>

      {usuario && menuAbierto && (
        <>
          <div id="barra-menu-movil" className="barra__panel">
            <nav className="barra__panel-nav" aria-label="Secciones">
              {enlaces}
            </nav>
            <Link to={`/usuarios/${usuario.id}`} className="barra__panel-cuenta">
              <span className="barra__avatar" aria-hidden="true">
                {inicial}
              </span>
              <span className="barra__nombre">{nombre}</span>
              {admin && <Chip estado="administrador" />}
            </Link>
            <button type="button" className="barra__panel-item" onClick={alSalir}>
              Cerrar sesión
            </button>
          </div>
          <div className="barra__velo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />
        </>
      )}
    </header>
  )
}
