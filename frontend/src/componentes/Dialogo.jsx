import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import './Dialogo.css'

/*
 * Diálogo modal para confirmar acciones irreversibles (retirar, bloquear,
 * baja) y para formularios cortos (alta y edición de un libro).
 *
 * Accesibilidad:
 *   - role="dialog", aria-modal y aria-labelledby apuntando al título.
 *   - Al abrir, el foco va al primer campo; si no hay campos, al elemento
 *     marcado con data-autofoco (el botón que NO destruye: «No, volver»);
 *     si no, al panel. El destructivo nunca lleva el foco inicial.
 *   - Tab y Shift+Tab quedan atrapados adentro.
 *   - Esc y el clic en el fondo cierran, salvo mientras `ocupado` (hay una
 *     petición en vuelo: cerrar ahí dejaría el resultado sin dueño).
 *   - Al cerrar, el foco vuelve a donde estaba (el botón que lo abrió).
 *
 * Se monta en un portal sobre <body> y bloquea el scroll de la página.
 *
 * props:
 *   abierto     bool
 *   titulo      string
 *   alCerrar    fn
 *   children    el contenido (texto, campos, avisos)
 *   acciones?   node   los botones, alineados a la derecha
 *   peligro?    bool   título en rojo y borde rojo (baja de cuenta)
 *   ocupado?    bool
 *   alEnviar?   fn(evento)  si viene, el contenido va dentro de un <form>
 */
export default function Dialogo({ abierto, ...resto }) {
  if (!abierto) return null
  return createPortal(<PanelDialogo {...resto} />, document.body)
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function PanelDialogo({ titulo, alCerrar, children, acciones, peligro = false, ocupado = false, alEnviar }) {
  const idTitulo = useId()
  const panel = useRef(null)
  const ocupadoRef = useRef(ocupado)
  const alCerrarRef = useRef(alCerrar)
  ocupadoRef.current = ocupado
  alCerrarRef.current = alCerrar

  // Foco inicial, bloqueo de scroll y devolución del foco al cerrar.
  useEffect(() => {
    const previo = document.activeElement
    const nodo = panel.current
    const destino =
      nodo.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
      nodo.querySelector('[data-autofoco]') ||
      nodo
    destino.focus()

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflowPrevio
      if (previo && typeof previo.focus === 'function' && document.contains(previo)) previo.focus()
    }
  }, [])

  function alTeclear(evento) {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      if (!ocupadoRef.current) alCerrarRef.current()
      return
    }
    if (evento.key !== 'Tab') return
    const enfocables = [...panel.current.querySelectorAll(ENFOCABLES)]
    if (enfocables.length === 0) {
      evento.preventDefault()
      return
    }
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (evento.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  function alTocarFondo(evento) {
    if (evento.target === evento.currentTarget && !ocupadoRef.current) alCerrarRef.current()
  }

  const Contenedor = alEnviar ? 'form' : 'div'

  return (
    <div className="dialogo" onMouseDown={alTocarFondo}>
      <div
        ref={panel}
        className={`dialogo__panel ${peligro ? 'dialogo__panel--peligro' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-busy={ocupado || undefined}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <Contenedor
          className="dialogo__cuerpo"
          {...(alEnviar ? { onSubmit: alEnviar, noValidate: true } : {})}
        >
          <h2 id={idTitulo} className="dialogo__titulo">
            {titulo}
          </h2>
          {children}
          {acciones && <div className="dialogo__acciones">{acciones}</div>}
        </Contenedor>
      </div>
    </div>
  )
}
