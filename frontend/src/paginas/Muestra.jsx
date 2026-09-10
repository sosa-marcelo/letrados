import { useState } from 'react'
import { Link } from 'react-router-dom'

import Tarjeta from '../componentes/Tarjeta.jsx'
import Campo from '../componentes/Campo.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Lema from '../componentes/Lema.jsx'
import { VERDE, NARANJA, complementarioDe } from '../estilos/pleno.js'
import './Muestra.css'

/*
 * Vitrina de los cuatro componentes base (LET-20). NO es una pantalla del
 * producto: la borra la épica que construya la home. Sin lógica de negocio;
 * los estados se togglean localmente para poder verlos.
 */
export default function Muestra() {
  const [paso, setPaso] = useState('entrar') // 'entrar' (verde) | 'crearCuenta' (naranja)
  const [correo, setCorreo] = useState('ana.perez@correo.com')
  const [conError, setConError] = useState(false)
  const [estadoPastilla, setEstadoPastilla] = useState('normal')

  const pleno = paso === 'entrar' ? VERDE : NARANJA
  const complementario = complementarioDe(pleno)

  return (
    <main className="muestra" style={{ background: pleno }}>
      <div className="muestra__aviso">
        Vitrina temporal de LET-20 · la borra la épica de la home ·{' '}
        <Link to="/">volver a la home</Link>
      </div>

      <div className="muestra__grilla">
        <div className="muestra__izq">
          <Lema
            texto={
              paso === 'entrar'
                ? 'Un libro *quieto* no le sirve a nadie.'
                : 'Poné a *circular* lo que ya leíste.'
            }
            pleno={pleno}
          />

          <div className="muestra__controles">
            <button
              type="button"
              className="muestra__toggle"
              onClick={() => setPaso(paso === 'entrar' ? 'crearCuenta' : 'entrar')}
            >
              Paso: {paso === 'entrar' ? 'entrar (verde)' : 'crear cuenta (naranja)'} — cambiar
            </button>
            <button
              type="button"
              className="muestra__toggle"
              onClick={() => setConError((v) => !v)}
            >
              Campo con error: {conError ? 'sí' : 'no'} — cambiar
            </button>
            <div className="muestra__estados">
              <span>Pastilla:</span>
              {['normal', 'cargando', 'exito'].map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`muestra__chip ${estadoPastilla === e ? 'es-activo' : ''}`}
                  onClick={() => setEstadoPastilla(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Tarjeta titulo={paso === 'entrar' ? 'Entrar' : 'Crear cuenta'}>
          <Campo
            id="muestra-correo"
            etiqueta="Correo"
            tipo="email"
            valor={correo}
            alCambiar={(e) => setCorreo(e.target.value)}
            pista="Probá moverte con Tab para ver el foco."
            error={conError ? 'Ese correo ya tiene cuenta.' : undefined}
            pleno={pleno}
            complementario={complementario}
          />
          <Campo
            id="muestra-clave"
            etiqueta="Contraseña"
            tipo="password"
            valor="clave-de-prueba"
            alCambiar={() => {}}
            pleno={pleno}
            complementario={complementario}
          />
          <Pastilla
            estado={estadoPastilla}
            pleno={pleno}
            onClick={() => {}}
          >
            {paso === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </Pastilla>
        </Tarjeta>
      </div>
    </main>
  )
}
