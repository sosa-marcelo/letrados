import { IconoEstrella } from './Iconos.jsx'
import './Reputacion.css'

/*
 * Reputación de una cuenta (RF-26): promedio con una cifra decimal y coma, y
 * la cantidad de valoraciones. Con cantidad cero o promedio nulo dice «Sin
 * valoraciones»: lo decide la interfaz, no la API.
 *
 * props:
 *   promedio?   number | null
 *   cantidad?   number
 *   conEstrellas? bool  dibuja las cinco estrellas (default true)
 */
export default function Reputacion({ promedio = null, cantidad = 0, conEstrellas = true, className = '' }) {
  if (!cantidad || promedio === null || promedio === undefined) {
    return <span className={`reputacion reputacion--sin ${className}`.trim()}>Sin valoraciones</span>
  }

  const redondeado = Math.round(promedio * 10) / 10
  const texto = redondeado.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const llenas = Math.round(promedio)

  return (
    <span
      className={`reputacion ${className}`.trim()}
      aria-label={`Reputación ${texto} de 5, ${cantidad} ${cantidad === 1 ? 'valoración' : 'valoraciones'}`}
    >
      {conEstrellas && (
        <span className="reputacion__estrellas" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <IconoEstrella key={n} llena={n <= llenas} />
          ))}
        </span>
      )}
      <b aria-hidden="true">{texto}</b>
      <span className="reputacion__cantidad" aria-hidden="true">
        · {cantidad} {cantidad === 1 ? 'valoración' : 'valoraciones'}
      </span>
    </span>
  )
}
