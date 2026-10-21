import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Campo from '../componentes/Campo.jsx'
import Lema from '../componentes/Lema.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Aviso from '../componentes/Aviso.jsx'
import Tarjeta from '../componentes/Tarjeta.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { complementarioDe, VERDE } from '../estilos/pleno.js'
import { ErrorApi, enviar } from '../servicios/cliente.js'
import { esSinRed, mapearDetalles } from '../servicios/errores.js'
import './PantallaAuth.css'
import './Login.css'

const PLENO = VERDE

/*
 * Estados de Entrar (02-autenticacion):
 *   - campos incompletos: se marca cada campo vacío sin llamar a la API.
 *   - cuenta no habilitada: 403 CUENTA_BLOQUEADA, se muestra el mensaje del
 *     servidor (sólo llega quien acertó la contraseña, DISENIO-GENERAL §7.4).
 *   - sin conexión: el servidor no contestó; el botón pasa a «Reintentar».
 *   - credenciales inválidas: el aviso genérico de siempre.
 * Además, arriba de la tarjeta, el aviso que deja la sesión al cerrarse sola:
 * «Tu cuenta fue eliminada» (baja) o «Tu sesión se cerró» (401).
 */
const AVISOS = {
  baja: 'Tu cuenta fue eliminada.',
  expirada: 'Tu sesión se cerró. Entrá de nuevo para seguir.',
}

export default function Login() {
  const { entrar, aviso, descartarAviso } = useSesion()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})
  const [sinRed, setSinRed] = useState(false)

  async function alEnviar(evento) {
    evento.preventDefault()
    setErrorGeneral(null)
    setErroresCampo({})

    // Campos incompletos: se resuelve acá, sin ida y vuelta al servidor.
    const faltantes = {}
    if (!email.trim()) faltantes.email = 'Ingresá tu correo.'
    if (!contrasena) faltantes.contrasena = 'Ingresá tu contraseña.'
    if (Object.keys(faltantes).length > 0) {
      setErroresCampo(faltantes)
      return
    }

    setEnviando(true)
    setSinRed(false)
    try {
      const { token, usuario } = await enviar('/auth/login', { email, contrasena })
      entrar(token, usuario)
      navigate('/mis-libros')
    } catch (error) {
      if (esSinRed(error)) {
        setSinRed(true)
        setErrorGeneral('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
      } else if (error.codigo === 'DATOS_INVALIDOS') {
        setErroresCampo(mapearDetalles(error.detalles))
      } else if (error.codigo === 'CUENTA_BLOQUEADA') {
        // Cuenta bloqueada o dada de baja: el mensaje del servidor dice por qué.
        setErrorGeneral(error.mensaje)
      } else {
        // Nunca se dice cuál de los dos campos falló (correo o contraseña):
        // confirmarlo le diría a un desconocido qué cuentas existen.
        setErrorGeneral(error instanceof ErrorApi ? error.mensaje : 'No se pudo completar la solicitud.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main
      className="pantalla-auth"
      style={{ background: PLENO, '--complementario': complementarioDe(PLENO) }}
    >
      <div className="pantalla-auth__orbes" aria-hidden="true">
        <span className="pantalla-auth__orbe pantalla-auth__orbe--a" />
        <span className="pantalla-auth__orbe pantalla-auth__orbe--b" />
        <span className="pantalla-auth__orbe pantalla-auth__orbe--c" />
      </div>

      <div className="pantalla-auth__izq">
        <p className="pantalla-auth__marca">
          <IconoMarca />
          Letrados
        </p>
        <Lema texto="Un libro *quieto* no le sirve a nadie." pleno={PLENO} como="h2" />
        <p className="pantalla-auth__sub">
          Acá los libros cambian de manos: se intercambian o se regalan. Nada se vende.
        </p>
      </div>

      <div className="pantalla-auth__tarjeta login__columna">
        {aviso && AVISOS[aviso] && (
          <Aviso tipo="info" className="login__aviso" alCerrar={descartarAviso}>
            <b>{AVISOS[aviso]}</b>
          </Aviso>
        )}
        <Tarjeta titulo="Entrar">
          {errorGeneral && (
            <p className="pantalla-auth__alerta" role="alert">
              <IconoAlerta />
              <span>{errorGeneral}</span>
            </p>
          )}

          <form onSubmit={alEnviar} noValidate>
            <Campo
              id="login-email"
              etiqueta="Correo"
              tipo="email"
              valor={email}
              alCambiar={(e) => setEmail(e.target.value)}
              error={erroresCampo.email}
              pleno={PLENO}
              autoComplete="email"
              required
            />
            <Campo
              id="login-contrasena"
              etiqueta="Contraseña"
              valor={contrasena}
              alCambiar={(e) => setContrasena(e.target.value)}
              error={erroresCampo.contrasena}
              pleno={PLENO}
              conMostrar
              autoComplete="current-password"
              required
            />
            <Pastilla tipo="submit" estado={enviando ? 'cargando' : 'normal'} pleno={PLENO}>
              {sinRed ? 'Reintentar' : 'Entrar'}
              <IconoFlecha />
            </Pastilla>
          </form>

          <div className="pantalla-auth__pie">
            <Link to="/recuperar">Me olvidé la contraseña</Link>
            <p>
              ¿Primera vez? <Link to="/registro">Creá tu cuenta</Link>
            </p>
          </div>
        </Tarjeta>
      </div>
    </main>
  )
}

function IconoMarca() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18.2 8.4A7.6 7.6 0 0 0 4.6 6.9" />
      <path d="M3.8 13.6a7.6 7.6 0 0 0 13.6 1.5" />
      <path d="M4.4 2.9v4h4" />
      <path d="M17.6 19.1v-4h-4" />
    </svg>
  )
}

function IconoAlerta() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7" />
      <path d="M9 5.4v4.2" />
      <path d="M9 12.4h.01" />
    </svg>
  )
}

function IconoFlecha() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 9h11" />
      <path d="M10 4.5L14.5 9 10 13.5" />
    </svg>
  )
}
