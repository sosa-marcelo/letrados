import { IconoAlerta, IconoCheck } from './Iconos.jsx'
import './Aviso.css'

/*
 * Franja de aviso dentro de un papel o arriba de una lista.
 *
 *   'error'  rosado con filete rojo — el mismo aviso de las pantallas de auth
 *            (pantalla-auth__alerta), role="alert".
 *   'exito'  verde lleno con borde tinta y tilde, role="status".
 *   'info'   crema con borde tinta, role="status".
 *
 * props:
 *   tipo?       'error' | 'exito' | 'info'   (default 'error')
 *   titulo?     string    primera línea en negrita
 *   children              el texto
 *   alCerrar?   fn        si viene, agrega «Cerrar»
 */
export default function Aviso({ tipo = 'error', titulo, children, alCerrar, className = '' }) {
  return (
    <div
      className={`aviso aviso--${tipo} ${className}`.trim()}
      role={tipo === 'error' ? 'alert' : 'status'}
    >
      <span className="aviso__icono">{tipo === 'error' ? <IconoAlerta /> : <IconoCheck />}</span>
      <span className="aviso__texto">
        {titulo && <b>{titulo}</b>}
        {titulo && children && <br />}
        {children}
      </span>
      {alCerrar && (
        <button type="button" className="aviso__cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      )}
    </div>
  )
}
