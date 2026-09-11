import { useNavigate } from 'react-router-dom'

import { useSesion } from '../contexto/Sesion.jsx'
import './Home.css'

const PASOS = [
  'Tu cuenta',
  'Tu catálogo de libros',
  'Publicar e intercambiar',
  'Valorar a la contraparte',
]

export default function Home() {
  const { usuario, salir } = useSesion()
  const navigate = useNavigate()

  const nombreCompleto = usuario?.nombre ?? ''
  const primerNombre = nombreCompleto.split(' ')[0]
  const inicial = nombreCompleto.trim().charAt(0).toUpperCase() || '?'

  function alCerrarSesion() {
    salir()
    navigate('/login')
  }

  return (
    <main className="home">
      <div className="home__orbes" aria-hidden="true">
        <span className="home__orbe home__orbe--a" />
        <span className="home__orbe home__orbe--b" />
        <span className="home__orbe home__orbe--c" />
      </div>

      <div className="home__barra">
        <span className="home__marca">
          <IconoMarca />
          Letrados
        </span>
        <span className="home__sesion">
          <span className="home__avatar" aria-hidden="true">
            {inicial}
          </span>
          <span className="home__nombre">{nombreCompleto}</span>
          <button className="home__salir" type="button" onClick={alCerrarSesion}>
            <IconoSalir />
            Cerrar sesión
          </button>
        </span>
      </div>

      <div className="home__centro">
        <div>
          <span className="home__etiqueta">
            <IconoCheck />
            Entraste
          </span>
          <h1 className="home__titulo">{primerNombre ? `Hola, ${primerNombre}.` : 'Hola.'}</h1>
          <p className="home__cuerpo">
            Por ahora esto está vacío. Los libros, las publicaciones y los intercambios llegan en
            las próximas entregas.
          </p>
        </div>

        <div className="home__tarjeta">
          <h2>Lo que viene</h2>
          <p>El orden de las entregas.</p>
          {PASOS.map((paso, i) => (
            <div key={paso} className={`home__paso ${i === 0 ? 'home__paso--ahora' : ''}`.trim()}>
              <span className="home__n">{i + 1}</span>
              <span>{paso}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

function IconoMarca() {
  return (
    <svg
      width="22"
      height="22"
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

function IconoSalir() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.2 13.5H3.5v-11h2.7" />
      <path d="M10 11l3-3-3-3" />
      <path d="M13 8H6.5" />
    </svg>
  )
}

function IconoCheck() {
  return (
    <svg
      width="14"
      height="14"
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
