import Boton from './Boton.jsx'
import './Paginador.css'

/*
 * Anterior / siguiente + la posición («1 – 6 de 7»). Va siempre al pie y en
 * el mismo lugar, aunque haya una sola página (con los dos botones
 * deshabilitados): que aparezca y desaparezca haría saltar la pantalla.
 *
 * props:
 *   pagina      number   1-based
 *   porPagina   number
 *   total       number   cantidad total de elementos
 *   alCambiar   fn(paginaNueva)
 */
export default function Paginador({ pagina, porPagina, total, alCambiar }) {
  const ultima = Math.max(1, Math.ceil(total / porPagina))
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <nav className="paginador" aria-label="Paginación">
      <Boton
        variante="papel"
        tamano="chico"
        disabled={pagina <= 1}
        onClick={() => alCambiar(pagina - 1)}
      >
        Anterior
      </Boton>
      <span className="paginador__posicion" aria-live="polite">
        {desde} – {hasta} de {total}
      </span>
      <Boton
        variante="papel"
        tamano="chico"
        disabled={pagina >= ultima}
        onClick={() => alCambiar(pagina + 1)}
      >
        Siguiente
      </Boton>
    </nav>
  )
}
