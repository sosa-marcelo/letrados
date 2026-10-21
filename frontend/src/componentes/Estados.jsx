import Aviso from './Aviso.jsx'
import Boton from './Boton.jsx'
import './Estados.css'

/*
 * Piezas de los estados «cargando» y «error» de las pantallas de datos
 * (DISENIO-GENERAL §8.5). El vacío es el componente Vacio.
 *
 * El esqueleto repite el borde y el radio de lo que reemplaza, en hundido:
 * no cambia el alto de la página cuando llegan los datos. No es un spinner
 * centrado.
 */

/** Papel con el aviso de error y «Reintentar». */
export function ErrorCarga({ mensaje, alReintentar }) {
  return (
    <div className="papel estados__error">
      <Aviso tipo="error">{mensaje}</Aviso>
      {alReintentar && (
        <Boton variante="contorno" onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  )
}

/** Grilla de fichas fantasma. */
export function EsqueletoFichas({ cantidad = 6 }) {
  return (
    <div className="grilla-fichas" aria-hidden="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="esqueleto-ficha">
          <span className="esqueleto__barra" style={{ width: '55%' }} />
          <span className="esqueleto__barra esqueleto__barra--chica" style={{ width: '35%' }} />
          <span className="esqueleto__bloque" />
          <span className="esqueleto__linea" />
          <span className="esqueleto__barra esqueleto__barra--chica" style={{ width: '38%' }} />
        </div>
      ))}
    </div>
  )
}

/** Filas fantasma para la tabla de papel. */
export function EsqueletoFilas({ cantidad = 4 }) {
  return (
    <div className="papel esqueleto-tabla" aria-hidden="true">
      <span className="esqueleto__barra esqueleto__barra--chica" style={{ width: '12%' }} />
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="esqueleto-tabla__fila">
          <span className="esqueleto-tabla__col">
            <span className="esqueleto__barra" style={{ width: '70%' }} />
            <span className="esqueleto__barra esqueleto__barra--chica" style={{ width: '90%' }} />
          </span>
          <span className="esqueleto__pildora" />
          <span className="esqueleto__pildora esqueleto__pildora--ancha" />
        </div>
      ))}
    </div>
  )
}

/** Un papel fantasma con `lineas` campos. */
export function EsqueletoPapel({ lineas = 3 }) {
  return (
    <div className="papel esqueleto-papel" aria-hidden="true">
      <span className="esqueleto__barra" style={{ width: '30%', height: 18 }} />
      {Array.from({ length: lineas }, (_, i) => (
        <span key={i} className="esqueleto-papel__campo">
          <span className="esqueleto__barra esqueleto__barra--chica" style={{ width: '22%' }} />
          <span className="esqueleto__campo" />
        </span>
      ))}
    </div>
  )
}

/** Texto para lectores de pantalla mientras carga (role=status). */
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <p className="solo-lector" role="status">
      {texto}
    </p>
  )
}
