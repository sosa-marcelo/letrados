/*
 * Íconos de trazo de las pantallas con Marco. Mismo dibujo que los que ya
 * viven adentro de las pantallas de autenticación (se dejaron ahí para no
 * tocar archivos congelados); acá quedan compartidos para lo nuevo.
 * Todos son decorativos: aria-hidden y currentColor.
 */

function Trazo({ tam = 16, caja = '0 0 18 18', grosor = 1.9, children, ...resto }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox={caja}
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  )
}

export function IconoMarca({ tam = 21 }) {
  return (
    <Trazo tam={tam} caja="0 0 22 22">
      <path d="M18.2 8.4A7.6 7.6 0 0 0 4.6 6.9" />
      <path d="M3.8 13.6a7.6 7.6 0 0 0 13.6 1.5" />
      <path d="M4.4 2.9v4h4" />
      <path d="M17.6 19.1v-4h-4" />
    </Trazo>
  )
}

export function IconoAlerta({ tam = 16 }) {
  return (
    <Trazo tam={tam}>
      <circle cx="9" cy="9" r="7" />
      <path d="M9 5.4v4.2" />
      <path d="M9 12.4h.01" />
    </Trazo>
  )
}

export function IconoCheck({ tam = 14 }) {
  return (
    <Trazo tam={tam} caja="0 0 16 16" grosor={2.6}>
      <path d="M3 8.4l3.2 3.2L13 4.8" />
    </Trazo>
  )
}

export function IconoPendiente({ tam = 13 }) {
  return (
    <Trazo tam={tam} caja="0 0 16 16">
      <circle cx="8" cy="8" r="5.4" />
    </Trazo>
  )
}

export function IconoLupa({ tam = 16 }) {
  return (
    <Trazo tam={tam} grosor={2}>
      <circle cx="8" cy="8" r="5.4" />
      <path d="M12 12l3.4 3.4" />
    </Trazo>
  )
}

export function IconoFlechaAbajo({ tam = 12 }) {
  return (
    <Trazo tam={tam} caja="0 0 16 16" grosor={2.4}>
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </Trazo>
  )
}

export function IconoMenu({ tam = 20 }) {
  return (
    <Trazo tam={tam} caja="0 0 20 20" grosor={2.2}>
      <path d="M3 5.5h14" />
      <path d="M3 10h14" />
      <path d="M3 14.5h14" />
    </Trazo>
  )
}

export function IconoCerrar({ tam = 18 }) {
  return (
    <Trazo tam={tam} caja="0 0 20 20" grosor={2.2}>
      <path d="M5 5l10 10" />
      <path d="M15 5L5 15" />
    </Trazo>
  )
}

export function IconoEstrella({ tam = 14, llena = true }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.6l1.95 4.1 4.45.55-3.27 3.08.84 4.42L8 11.6l-3.97 2.15.84-4.42L1.6 6.25l4.45-.55z"
        fill={llena ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
