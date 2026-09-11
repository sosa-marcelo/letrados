import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import Campo from '../componentes/Campo.jsx'
import Lema from '../componentes/Lema.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Tarjeta from '../componentes/Tarjeta.jsx'
import { complementarioDe, NARANJA } from '../estilos/pleno.js'
import { ErrorApi, enviar } from '../servicios/cliente.js'
import './PantallaAuth.css'
import './ContrasenaNueva.css'

const PLENO = NARANJA

// Mismos textos y mismos predicados que LET-24 (Crear cuenta): tienen que
// medir exactamente lo mismo que valida el backend.
const REQUISITOS = [
  { clave: 'longitud', texto: 'Al menos 8 caracteres', cumple: (c) => c.length >= 8 },
  { clave: 'letra', texto: 'Una letra', cumple: (c) => /[a-zA-Z]/.test(c) },
  { clave: 'numero', texto: 'Un número', cumple: (c) => /[0-9]/.test(c) },
]

export default function ContrasenaNueva() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [contrasena, setContrasena] = useState('')
  const [repetir, setRepetir] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  const cumpleTodos = REQUISITOS.every((r) => r.cumple(contrasena))
  const coinciden = repetir.length > 0 && repetir === contrasena

  async function alEnviar(evento) {
    evento.preventDefault()
    setErrorGeneral(null)
    setErroresCampo({})

    // Que coincidan es validación sólo de cliente: si no coinciden, ni
    // siquiera se llama a la API. El cuerpo nunca lleva la repetición.
    if (!coinciden) {
      setErroresCampo({ repetir: 'Las contraseñas no coinciden.' })
      return
    }

    setEnviando(true)
    try {
      await enviar('/auth/recuperacion/confirmar', { token, contrasena })
      navigate('/login')
    } catch (error) {
      if (!(error instanceof ErrorApi)) {
        setErrorGeneral('No se pudo completar la solicitud.')
      } else if (error.codigo === 'DATOS_INVALIDOS') {
        setErroresCampo(mapearDetalles(error.detalles))
      } else if (error.codigo === 'TOKEN_INVALIDO') {
        setErrorGeneral(
          <>
            El enlace venció o ya se usó. <Link to="/recuperar">Pedí uno nuevo</Link>.
          </>,
        )
      } else {
        setErrorGeneral(error.mensaje)
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
        <Lema texto="Última *parada*." pleno={PLENO} como="h2" />
        <p className="pantalla-auth__sub">Ponés una contraseña nueva y volvés a lo tuyo.</p>
      </div>

      <Tarjeta titulo="Elegí una nueva" className="pantalla-auth__tarjeta">
        <p className="pantalla-auth__texto">Que puedas recordar sin anotarla en ningún lado.</p>

        {errorGeneral && (
          <p className="pantalla-auth__alerta" role="alert">
            <IconoAlerta />
            <span>{errorGeneral}</span>
          </p>
        )}

        <form onSubmit={alEnviar} noValidate>
          <div className="contrasena-nueva__grupo-clave">
            <Campo
              id="nueva-contrasena"
              etiqueta="Contraseña nueva"
              tipo="password"
              valor={contrasena}
              alCambiar={(e) => setContrasena(e.target.value)}
              error={erroresCampo.contrasena}
              pleno={PLENO}
              autoComplete="new-password"
              required
            />
            <ul className="pantalla-auth__requisitos contrasena-nueva__requisitos">
              {REQUISITOS.map((r) => {
                const cumplido = r.cumple(contrasena)
                return (
                  <li key={r.clave} className={cumplido ? 'es-cumplido' : ''}>
                    {cumplido ? <IconoCheck /> : <IconoPendiente />}
                    {r.texto}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="contrasena-nueva__grupo-repetir">
            <Campo
              id="nueva-repetir"
              etiqueta="Repetila"
              tipo="password"
              valor={repetir}
              alCambiar={(e) => setRepetir(e.target.value)}
              error={erroresCampo.repetir}
              pleno={PLENO}
              autoComplete="new-password"
              required
            />
            {coinciden && (
              <p className="pantalla-auth__ok">
                <IconoCheck />
                Coinciden
              </p>
            )}
          </div>

          <Pastilla
            tipo="submit"
            estado={enviando ? 'cargando' : 'normal'}
            pleno={PLENO}
            disabled={!cumpleTodos || !coinciden}
          >
            Guardar contraseña
            <IconoFlecha />
          </Pastilla>
        </form>
      </Tarjeta>
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

function IconoCheck() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.4l3.2 3.2L13 4.8" />
    </svg>
  )
}

function IconoPendiente() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="8" cy="8" r="5.4" />
    </svg>
  )
}
