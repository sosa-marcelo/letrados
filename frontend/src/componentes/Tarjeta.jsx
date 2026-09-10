import './Tarjeta.css'

/*
 * El papel: la tarjeta de fondo crema con borde negro y sombra dura donde
 * flota el formulario. Recibe un título opcional y el contenido.
 *
 * props:
 *   titulo?    string    se renderiza en un <h1> arriba del contenido
 *   children             el contenido de la tarjeta
 *   className? string    clases extra
 *   ...resto             se pasan al <section> raíz
 */
export default function Tarjeta({ titulo, children, className = '', ...resto }) {
  return (
    <section className={`tarjeta ${className}`.trim()} {...resto}>
      {titulo && <h1 className="tarjeta__titulo">{titulo}</h1>}
      {children}
    </section>
  )
}
