import { complementarioDe } from '../estilos/pleno.js'
import './Lema.css'

/*
 * El titular grande de Bricolage que va a la izquierda de la tarjeta, con una
 * palabra (o frase) resaltada en el color complementario del paso.
 *
 * La parte a resaltar se marca con asteriscos en `texto`:
 *   <Lema texto="Un libro *quieto* no le sirve a nadie." pleno="var(--verde)" />
 *
 * props:
 *   texto        string   con *lo resaltado* entre asteriscos
 *   pleno?       string   color pleno del paso (default var(--verde))
 *   complementario? string color del resaltado (default: complementario de `pleno`)
 *   como?        etiqueta a renderizar (default 'p')
 *   ...resto              se pasan al elemento raíz
 */
export default function Lema({
  texto = '',
  pleno = 'var(--verde)',
  complementario,
  como: Como = 'p',
  ...resto
}) {
  const partes = texto.split(/\*([^*]+)\*/) // [antes, resaltado, entre, resaltado, ...]

  return (
    <Como
      className="lema"
      style={{ '--complementario': complementario || complementarioDe(pleno) }}
      {...resto}
    >
      {partes.map((parte, i) =>
        i % 2 === 1 ? (
          <em key={i} className="lema__resaltado">
            {parte}
          </em>
        ) : (
          parte
        ),
      )}
    </Como>
  )
}
