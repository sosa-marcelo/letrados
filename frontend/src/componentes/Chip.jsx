import { IconoCheck } from './Iconos.jsx'
import './Chip.css'

/*
 * Etiqueta de estado. El color de cada estado se fija acá, una sola vez, y
 * ninguna pantalla lo repite (DISENIO-GENERAL §8.4).
 *
 *   activa                  verde
 *   bloqueada               rojo
 *   eliminada               hundido, texto gris
 *   pendiente               hundido con borde tinta
 *   aceptada                verde
 *   completada              verde con tilde
 *   rechazada / cancelada   gris
 *   flagueada               rojo
 *   administrador           naranja («Admin»)
 *
 * props:
 *   estado      una de las claves de arriba
 *   children?   texto propio (default: el nombre del estado)
 */
const ESTADOS = {
  activa: { texto: 'Activa', color: 'verde' },
  bloqueada: { texto: 'Bloqueada', color: 'rojo' },
  eliminada: { texto: 'Eliminada', color: 'hundido' },
  pendiente: { texto: 'Pendiente', color: 'pendiente' },
  aceptada: { texto: 'Aceptada', color: 'verde' },
  completada: { texto: 'Completada', color: 'verde', tilde: true },
  rechazada: { texto: 'Rechazada', color: 'gris' },
  cancelada: { texto: 'Cancelada', color: 'gris' },
  flagueada: { texto: 'Flagueada', color: 'rojo' },
  administrador: { texto: 'Admin', color: 'naranja' },
}

export default function Chip({ estado, children }) {
  const info = ESTADOS[estado] || { texto: estado, color: 'gris' }
  return (
    <span className={`chip chip--${info.color}`}>
      {info.tilde && <IconoCheck tam={11} />}
      {children || info.texto}
    </span>
  )
}
