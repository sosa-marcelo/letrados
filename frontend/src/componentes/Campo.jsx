import { useState } from 'react'

import { complementarioDe } from '../estilos/pleno.js'
import './Campo.css'

/*
 * Etiqueta + input + pista + error. Fondo hundido, sin borde, con un realce
 * interno arriba. Tres estados: reposo, foco y error.
 *
 * El foco de teclado dibuja un contorno en el color complementario del paso
 * (verde sobre naranja, naranja sobre verde). Por eso el componente recibe el
 * color pleno del paso como parámetro; si no le pasan `complementario`, lo
 * deriva de `pleno`.
 *
 * props:
 *   id           string   obligatorio, enlaza label e input
 *   etiqueta     string
 *   tipo?        string   default 'text'
 *   valor?       string
 *   alCambiar?   fn(evento)
 *   pista?       string    texto de ayuda debajo del input
 *   error?       string    si viene, marca el campo y muestra el aviso (role="alert")
 *   pleno?       string    color pleno del paso (default var(--verde))
 *   complementario? string color del contorno de foco (default: complementario de `pleno`)
 *   conMostrar?  bool     agrega el botón "Mostrar/Ocultar" (para contraseñas).
 *                         Apagado por defecto: no cambia el aspecto de ningún
 *                         campo existente. Alterna el `type` entre password y
 *                         text; no le roba el foco al input al hacer clic.
 *   ...resto              se pasan al <input>
 */
export default function Campo({
  id,
  etiqueta,
  tipo = 'text',
  valor,
  alCambiar,
  pista,
  error,
  pleno = 'var(--verde)',
  complementario,
  conMostrar = false,
  ...resto
}) {
  const [mostrar, setMostrar] = useState(false)
  const idPista = pista ? `${id}-pista` : undefined
  const idError = error ? `${id}-error` : undefined
  const describe = [idError, idPista].filter(Boolean).join(' ') || undefined
  const tipoReal = conMostrar ? (mostrar ? 'text' : 'password') : tipo

  return (
    <div
      className={`campo ${error ? 'campo--error' : ''}`.trim()}
      style={{ '--complementario': complementario || complementarioDe(pleno) }}
    >
      <div className="campo__fila">
        <label className="campo__etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
        {conMostrar && (
          <button
            type="button"
            className="campo__mini"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMostrar((v) => !v)}
          >
            {mostrar ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      <input
        id={id}
        className="campo__input"
        type={tipoReal}
        value={valor}
        onChange={alCambiar}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        {...resto}
      />
      {error && (
        <p className="campo__error" id={idError} role="alert">
          {error}
        </p>
      )}
      {pista && (
        <p className="campo__pista" id={idPista}>
          {pista}
        </p>
      )}
    </div>
  )
}
