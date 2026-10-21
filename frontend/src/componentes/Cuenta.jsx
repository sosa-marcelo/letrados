import { Link } from 'react-router-dom'

import Reputacion from './Reputacion.jsx'
import './Cuenta.css'

/*
 * Una cuenta mostrada a otra persona: inicial, nombre y (opcional)
 * reputación, con enlace al perfil público /usuarios/:id (RF-08). Se usa
 * donde aparece la contraparte: publicaciones, solicitudes, intercambios.
 *
 * Una cuenta eliminada (RF-09) se sigue enlazando —el perfil público responde
 * 200 con «Cuenta eliminada»— pero se dibuja apagada.
 *
 * props:
 *   id            string
 *   nombre        string
 *   eliminada?    bool
 *   reputacion?   { promedio, cantidad }   si viene, se muestra debajo
 */
export default function Cuenta({ id, nombre, eliminada = false, reputacion }) {
  const inicial = eliminada ? '—' : (nombre || '?').trim().charAt(0).toUpperCase()

  return (
    <Link to={`/usuarios/${id}`} className={`cuenta ${eliminada ? 'cuenta--eliminada' : ''}`.trim()}>
      <span className="cuenta__avatar" aria-hidden="true">
        {inicial}
      </span>
      <span className="cuenta__datos">
        <span className="cuenta__nombre">{eliminada ? 'Cuenta eliminada' : nombre}</span>
        {reputacion && !eliminada && (
          <Reputacion promedio={reputacion.promedio} cantidad={reputacion.cantidad} conEstrellas={false} />
        )}
      </span>
    </Link>
  )
}
