import { useEffect } from 'react'

import { complementarioDe, textoSobre, VERDE } from '../estilos/pleno.js'
import Barra from './Barra.jsx'
import Lema from './Lema.jsx'
import './Marco.css'

/*
 * Marco de aplicación (DISENIO-GENERAL §8.2): barra + franja + lienzo.
 *
 *   BARRA  · tinta, 64 px, fija arriba                 logo · nav · cuenta
 *   FRANJA · color pleno de la sección, 150 px         lema + acción principal
 *   LIENZO · crema; el papel sube 44 px sobre la franja
 *
 * El papel que monta sobre el borde de la franja es el mismo gesto que la
 * tarjeta flotando sobre el pleno en las pantallas de autenticación: es lo
 * que hace que la aplicación se lea como el mismo producto.
 *
 * Color por sección (§8.3): verde lo propio, naranja lo que mira un tercero,
 * tinta lo operativo. El texto de la franja se deriva del pleno (crema sobre
 * verde y tinta, tinta sobre naranja) y el resaltado del lema y el foco de
 * teclado usan el complementario.
 *
 * props:
 *   pleno?         color pleno de la sección (default verde)
 *   lema?          string con *resaltado*, p. ej. «Tu *biblioteca*.»
 *   titulo?        string   titular sin resaltado (si no hay lema)
 *   encabezado?    node     reemplaza lema/título (p. ej. el perfil público)
 *   sub?           node     línea chica debajo del titular
 *   accion?        node     la acción principal, a la derecha (una sola)
 *   tituloPagina?  string   para document.title
 *   children                el lienzo
 */
export default function Marco({
  pleno = VERDE,
  lema,
  titulo,
  encabezado,
  sub,
  accion,
  tituloPagina,
  children,
}) {
  useEffect(() => {
    if (tituloPagina) document.title = `${tituloPagina} · Letrados`
    return () => {
      document.title = 'Letrados'
    }
  }, [tituloPagina])

  const fondoTexto = textoSobre(pleno)

  return (
    <div
      className="marco"
      style={{
        '--marco-pleno': pleno,
        '--marco-texto': fondoTexto,
        '--complementario': complementarioDe(pleno),
      }}
    >
      <a href="#contenido" className="marco__saltar">
        Saltar al contenido
      </a>
      <Barra />

      <div className="marco__franja">
        <div className="marco__franja-interior">
          <div className="marco__encabezado">
            {encabezado ||
              (lema ? (
                <Lema texto={lema} pleno={pleno} como="h1" />
              ) : (
                <h1 className="marco__titulo">{titulo}</h1>
              ))}
            {sub && <div className="marco__sub">{sub}</div>}
          </div>
          {accion && <div className="marco__accion">{accion}</div>}
        </div>
      </div>

      <main id="contenido" className="marco__lienzo" tabIndex={-1}>
        <div className="marco__lienzo-interior">{children}</div>
      </main>
    </div>
  )
}
