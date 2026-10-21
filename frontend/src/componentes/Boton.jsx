import { Link } from 'react-router-dom'

import './Boton.css'

/*
 * Botón chico de pastilla para las pantallas con Marco: acciones de ficha,
 * de fila, de diálogo y del paginador. La Pastilla del ciclo 1 sigue siendo
 * el botón principal a todo el ancho de los formularios de auth; éste es su
 * hermano de ancho automático.
 *
 * Variantes (el color dice qué hace el botón, no dónde está):
 *   'contorno'          fondo transparente, borde tinta     (default; «No, volver»)
 *   'papel'             fondo blanco, borde tinta           (paginador, filas)
 *   'naranja'           fondo naranja, texto tinta          (acción principal)
 *   'verde'             fondo verde, texto crema            (desbloquear)
 *   'peligro'           fondo rojo, texto crema             (confirmar algo destructivo)
 *   'peligro-contorno'  texto y borde rojos                 (abrir un diálogo destructivo)
 *
 * Deshabilitado pierde el color: borde y texto atenuados, sin fondo. Cargando
 * muestra el aro naranja y `textoCargando` (p. ej. «Agregando…»), queda
 * disabled + aria-busy.
 *
 * props:
 *   variante?       ver arriba
 *   tamano?         'chico' (38 px) | 'normal' (44 px) | 'grande' (48 px)
 *   cargando?       bool
 *   textoCargando?  string   lo que dice mientras carga (default: el children)
 *   a?              string   si viene, se renderiza como <Link to={a}>
 *   tipo?           type del <button> (default 'button')
 *   ...resto        se pasan al <button> o al <Link>
 */
export default function Boton({
  children,
  variante = 'contorno',
  tamano = 'normal',
  cargando = false,
  textoCargando,
  a,
  tipo = 'button',
  disabled,
  className = '',
  ...resto
}) {
  const clases = [
    'boton',
    `boton--${variante}`,
    `boton--${tamano}`,
    cargando ? 'boton--cargando' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (a) {
    return (
      <Link to={a} className={clases} {...resto}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type={tipo}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando && <span className="boton__aro" aria-hidden="true" />}
      {cargando ? textoCargando || children : children}
    </button>
  )
}
