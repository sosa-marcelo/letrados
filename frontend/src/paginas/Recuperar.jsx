import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Campo from '../componentes/Campo.jsx'
import Lema from '../componentes/Lema.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Tarjeta from '../componentes/Tarjeta.jsx'
import { complementarioDe, TINTA, VERDE } from '../estilos/pleno.js'
import { ErrorApi, enviar } from '../servicios/cliente.js'
import './PantallaAuth.css'
import './Recuperar.css'

/*
 * Dos estados de la misma ruta /recuperar, no dos rutas: 'pedir' (tinta) y
 * 'enviado' (verde). El mensaje de 'enviado' es el mismo exista o no la
 * cuenta —el backend también contesta 200 siempre, por el mismo motivo—.
 */
export default function Recuperar() {
  const navigate = useNavigate()

  const [estado, setEstado] = useState('pedir')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  const pleno = estado === 'enviado' ? VERDE : TINTA

  async function alEnviar(evento) {
    evento.preventDefault()
    setErrorGeneral(null)
    setErroresCampo({})
    setEnviando(true)
    try {
      await enviar('/auth/recuperacion', { email })
      setEstado('enviado')
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'DATOS_INVALIDOS') {
        setErroresCampo(mapearDetalles(error.detalles))
      } else {
        setErrorGeneral(error instanceof ErrorApi ? error.mensaje : 'No se pudo completar la solicitud.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main
      className="pantalla-auth"
      style={{ background: pleno, '--complementario': complementarioDe(pleno) }}
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
        {estado === 'pedir' ? (
          <>
            <Lema texto="Le pasa a *cualquiera*." pleno={pleno} como="h2" />
            <p className="pantalla-auth__sub">
              Te mandamos un enlace y en dos minutos estás adentro otra vez.
            </p>
          </>
        ) : (
          <>
            <Lema texto="Salió *en camino*." pleno={pleno} como="h2" />
            <p className="pantalla-auth__sub">
              Como los libros: sale de acá y aparece del otro lado.
            </p>
          </>
        )}
      </div>

      {estado === 'pedir' ? (
        <Tarjeta className="pantalla-auth__tarjeta recuperar__tarjeta">
          <button
            type="button"
            className="pantalla-auth__volver"
            onClick={() => navigate('/login')}
          >
            <IconoFlechaVolver />
            Volver a iniciar sesión
          </button>

          <h1 className="tarjeta__titulo">Recuperar contraseña</h1>
          <p className="pantalla-auth__texto">
            Escribí tu correo y te mandamos un enlace para poner una nueva.
          </p>

          {errorGeneral && (
            <p className="pantalla-auth__alerta" role="alert">
              <IconoAlerta />
              <span>{errorGeneral}</span>
            </p>
          )}

          <form onSubmit={alEnviar} noValidate>
            <Campo
              id="recuperar-email"
              etiqueta="Correo"
              tipo="email"
              valor={email}
              alCambiar={(e) => setEmail(e.target.value)}
              error={erroresCampo.email}
              pleno={pleno}
              autoComplete="email"
              required
            />
            <Pastilla tipo="submit" estado={enviando ? 'cargando' : 'normal'} pleno={pleno}>
              Enviar enlace
            </Pastilla>
          </form>

          <div className="recuperar__dato">
            <IconoReloj />
            <span>
              El enlace vale 30 minutos y se usa una sola vez. Si pedís otro, el anterior deja de
              funcionar.
            </span>
          </div>
        </Tarjeta>
      ) : (
        <Tarjeta className="pantalla-auth__tarjeta">
          <span className="recuperar__sello">
            <IconoCheck />
            Listo
          </span>

          <h1 className="tarjeta__titulo">Mirá tu correo</h1>
          <p className="pantalla-auth__texto">
            Si <b>{email}</b> está registrado, te enviamos un enlace para restablecer la
            contraseña.
          </p>

          <div className="recuperar__lista">
            <div>
              <IconoReloj />
              <span>Vale 30 minutos y se usa una sola vez.</span>
            </div>
            <div>
              <IconoSobre />
              <span>¿No llegó? Revisá el correo no deseado antes de pedir otro.</span>
            </div>
          </div>

          <button type="button" className="recuperar__volver" onClick={() => navigate('/login')}>
            <IconoFlechaVolver />
            Volver a iniciar sesión
          </button>
        </Tarjeta>
      )}
    </main>
  )
}

/** { campo, mensaje }[] -> { [campo]: mensaje } */
function mapearDetalles(detalles) {
  const mapa = {}
  for (const d of detalles) {
    if (d && d.campo) mapa[d.campo] = d.mensaje
  }
  return mapa
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

function IconoFlechaVolver() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 3.5L5 8l4.5 4.5" />
    </svg>
  )
}

function IconoReloj() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7" />
      <path d="M9 5.2V9l2.4 1.6" />
    </svg>
  )
}

function IconoSobre() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="13" height="10" rx="1.4" />
      <path d="M2.5 6l6.5 4 6.5-4" />
    </svg>
  )
}

function IconoCheck() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.4l3.2 3.2L13 4.8" />
    </svg>
  )
}
