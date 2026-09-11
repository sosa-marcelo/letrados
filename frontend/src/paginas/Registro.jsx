import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Campo from '../componentes/Campo.jsx'
import Lema from '../componentes/Lema.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Tarjeta from '../componentes/Tarjeta.jsx'
import { complementarioDe, NARANJA } from '../estilos/pleno.js'
import { ErrorApi, enviar } from '../servicios/cliente.js'
import { guardarToken } from '../servicios/token.js'
import './PantallaAuth.css'
import './Registro.css'

const PLENO = NARANJA

const REQUISITOS = [
  { clave: 'longitud', texto: 'Al menos 8 caracteres', cumple: (c) => c.length >= 8 },
  { clave: 'letra', texto: 'Una letra', cumple: (c) => /[a-zA-Z]/.test(c) },
  { clave: 'numero', texto: 'Un número', cumple: (c) => /[0-9]/.test(c) },
]

export default function Registro() {
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  async function alEnviar(evento) {
    evento.preventDefault()
    setErrorGeneral(null)
    setErroresCampo({})
    setEnviando(true)
    try {
      const { token } = await enviar('/auth/registro', { nombre, email, contrasena })
      guardarToken(token)
      navigate('/')
    } catch (error) {
      if (!(error instanceof ErrorApi)) {
        setErrorGeneral('No se pudo completar la solicitud.')
      } else if (error.codigo === 'DATOS_INVALIDOS') {
        setErroresCampo(mapearDetalles(error.detalles))
      } else if (error.codigo === 'EMAIL_DUPLICADO') {
        setErroresCampo({
          // Un solo <span> a propósito: campo__error es flex con gap, y un
          // fragment con varios hijos (texto + link + texto) quedaría con
          // ese espacio metido entre cada uno.
          email: (
            <span>
              Ese correo ya tiene cuenta. <Link to="/login">Entrá</Link>.
            </span>
          ),
        })
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
        <Lema texto="Poné a *circular* lo que ya leíste." pleno={PLENO} como="h2" />
        <p className="pantalla-auth__sub">Cargás tus libros, alguien los pide, y siguen viaje.</p>
      </div>

      <Tarjeta titulo="Crear cuenta" className="pantalla-auth__tarjeta">
        {errorGeneral && (
          <p className="pantalla-auth__alerta" role="alert">
            <IconoAlerta />
            <span>{errorGeneral}</span>
          </p>
        )}

        <form onSubmit={alEnviar} noValidate>
          <Campo
            id="registro-nombre"
            etiqueta="Nombre"
            valor={nombre}
            alCambiar={(e) => setNombre(e.target.value)}
            pista="Hasta 80 caracteres."
            error={erroresCampo.nombre}
            pleno={PLENO}
            autoComplete="name"
            maxLength={80}
            required
          />
          <Campo
            id="registro-email"
            etiqueta="Correo"
            tipo="email"
            valor={email}
            alCambiar={(e) => setEmail(e.target.value)}
            error={erroresCampo.email}
            pleno={PLENO}
            autoComplete="email"
            required
          />
          <div className="registro__campo-clave">
            <Campo
              id="registro-contrasena"
              etiqueta="Contraseña"
              tipo="password"
              valor={contrasena}
              alCambiar={(e) => setContrasena(e.target.value)}
              error={erroresCampo.contrasena}
              pleno={PLENO}
              autoComplete="new-password"
              required
            />
            <ul className="pantalla-auth__requisitos registro__requisitos">
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

          <Pastilla tipo="submit" estado={enviando ? 'cargando' : 'normal'} pleno={PLENO}>
            Crear cuenta
            <IconoFlecha />
          </Pastilla>
        </form>

        <p className="pantalla-auth__pie">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </p>
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
