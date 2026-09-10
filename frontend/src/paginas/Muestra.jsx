import Relleno from '../componentes/Relleno.jsx'

/*
 * Vitrina de los componentes base. Se completa en LET-20.
 * La borra la épica que construya la home.
 */
export default function Muestra() {
  return (
    <Relleno
      pantalla="Muestra de componentes"
      epica="LET-20 (se completa a continuación)"
      rutas={[{ a: '/', texto: 'Home' }]}
    />
  )
}
