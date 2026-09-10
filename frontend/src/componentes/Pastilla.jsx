import { complementarioDe, textoSobre } from '../estilos/pleno.js'
import './Pastilla.css'

/*
 * El botón: pastilla con borde negro y radio total.
 *
 * En reposo va en el color COMPLEMENTARIO del paso, no en el pleno: si fuera
 * del mismo color que el fondo pleno de la pantalla, la única separación sería
 * el borde. El contraste es lo que lo hace aparecer (naranja sobre verde,
 * verde sobre naranja). Por eso la prop es `pleno` —el color del paso, que es
 * lo que la pantalla sabe— y el componente deriva el fondo y el texto.
 *
 * Tres estados:
 *   'normal'    fondo = complementario del paso; texto legible sobre ese fondo
 *   'cargando'  pierde el color y gira un aro naranja. Ocupa EL MISMO lugar:
 *               el contenido se oculta con visibility y el aro va absoluto y
 *               centrado, así no salta nada. Queda disabled + aria-busy.
 *   'exito'     fondo verde con un tilde. Queda disabled.
 *
 * props:
 *   children            el texto del botón
 *   estado?    'normal' | 'cargando' | 'exito'   (default 'normal')
 *   pleno?     string   color pleno del paso (default var(--verde))
 *   tipo?      string   type del <button> (default 'button')
 *   ...resto            se pasan al <button> (onClick, disabled, form, etc.)
 */
export default function Pastilla({
  children,
  estado = 'normal',
  pleno = 'var(--verde)',
  tipo = 'button',
  disabled,
  ...resto
}) {
  const cargando = estado === 'cargando'
  const exito = estado === 'exito'

  const fondo = complementarioDe(pleno)

  return (
    <button
      type={tipo}
      className={`pastilla pastilla--${estado}`}
      style={{ '--pastilla-fondo': fondo, '--pastilla-texto': textoSobre(fondo) }}
      disabled={disabled || cargando || exito}
      aria-busy={cargando || undefined}
      {...resto}
    >
      <span className="pastilla__contenido">
        {exito && (
          <svg
            className="pastilla__tilde"
            width="17"
            height="17"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8.4l3.2 3.2L13 4.8" />
          </svg>
        )}
        {children}
      </span>
      {cargando && <span className="pastilla__aro" aria-hidden="true" />}
      {cargando && <span className="pastilla__sr">Procesando…</span>}
    </button>
  )
}
