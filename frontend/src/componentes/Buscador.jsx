import { useEffect, useRef, useState } from 'react'

import { IconoLupa } from './Iconos.jsx'
import './Buscador.css'

/*
 * Campo de búsqueda con envío diferido: `alBuscar` se llama cuando la
 * persona deja de escribir por `retardo` ms (300 por defecto, RF-07, RF-13,
 * RF-15), no en cada tecla. Enter busca en el acto.
 *
 * Es semicontrolado: el texto que se escribe vive adentro, pero si `valor`
 * cambia desde afuera (p. ej. «Limpiar búsqueda») el campo lo adopta.
 *
 * Variantes:
 *   'papel'   barra de papel blanco con la etiqueta a la izquierda y un
 *             `extra` a la derecha (el conteo) — monta sobre la franja.
 *   'oscuro'  sobre una franja tinta: etiqueta arriba, borde crema.
 *
 * props:
 *   id            string   enlaza label e input
 *   valor?        string   búsqueda vigente (la que ya se aplicó)
 *   alBuscar      fn(texto recortado)
 *   etiqueta?     string   default 'Buscar'
 *   placeholder?  string
 *   extra?        node     a la derecha del campo (variante papel)
 *   variante?     'papel' | 'oscuro'
 *   retardo?      number   ms (default 300)
 */
export default function Buscador({
  id,
  valor = '',
  alBuscar,
  etiqueta = 'Buscar',
  placeholder,
  extra,
  variante = 'papel',
  retardo = 300,
}) {
  const [texto, setTexto] = useState(valor)
  const alBuscarRef = useRef(alBuscar)
  alBuscarRef.current = alBuscar

  // Si la búsqueda cambia desde afuera, el campo la refleja.
  useEffect(() => {
    setTexto((actual) => (actual.trim() === valor ? actual : valor))
  }, [valor])

  // Envío diferido: cada tecla reinicia el reloj.
  useEffect(() => {
    if (texto.trim() === valor) return undefined
    const reloj = setTimeout(() => alBuscarRef.current(texto.trim()), retardo)
    return () => clearTimeout(reloj)
  }, [texto, valor, retardo])

  function alEnviar(evento) {
    evento.preventDefault()
    if (texto.trim() !== valor) alBuscarRef.current(texto.trim())
  }

  return (
    <form role="search" className={`buscador buscador--${variante}`} onSubmit={alEnviar}>
      <label className="buscador__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="buscador__campo">
        <IconoLupa />
        <input
          id={id}
          className="buscador__input"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {extra && <span className="buscador__extra">{extra}</span>}
    </form>
  )
}
