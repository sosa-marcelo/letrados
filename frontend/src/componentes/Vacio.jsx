import './Vacio.css'

/*
 * Estado vacío de un listado: titular chico + texto + acción opcional, dentro
 * de un borde punteado («acá va a haber algo»). Nunca una caja muda: siempre
 * dice qué falta y, si se puede, qué hacer.
 *
 * props:
 *   titulo     string   p. ej. «Tu catálogo está vacío»
 *   texto?     string
 *   accion?    node     un botón o un enlace
 *   como?      etiqueta del titular (default 'h2')
 */
export default function Vacio({ titulo, texto, accion, como: Como = 'h2', className = '' }) {
  return (
    <div className={`vacio ${className}`.trim()}>
      <Como className="vacio__titulo">{titulo}</Como>
      {texto && <p className="vacio__texto">{texto}</p>}
      {accion && <div className="vacio__accion">{accion}</div>}
    </div>
  )
}
