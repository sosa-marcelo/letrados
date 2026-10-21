import './Ficha.css'

/*
 * Papel de listado: título, subtítulo, contenido libre y un pie de acciones.
 * La usan el catálogo (libros), y la van a usar publicaciones e intercambios.
 *
 * `atenuada` pasa la ficha a fondo hundido y borde al 30 %, sin sombra: el
 * contenido sigue legible y las acciones siguen visibles (DISENIO-MODULO-3 §4,
 * un libro sin ejemplares disponibles).
 *
 * props:
 *   titulo       string
 *   subtitulo?   string
 *   atenuada?    bool
 *   pie?         node     acciones, separadas del resto por un filete
 *   children              lo que va entre el encabezado y el pie
 *   como?        etiqueta raíz (default 'article')
 */
export default function Ficha({
  titulo,
  subtitulo,
  atenuada = false,
  pie,
  children,
  como: Como = 'article',
  className = '',
  ...resto
}) {
  return (
    <Como className={`ficha ${atenuada ? 'ficha--atenuada' : ''} ${className}`.trim()} {...resto}>
      <div>
        <h3 className="ficha__titulo">{titulo}</h3>
        {subtitulo && <p className="ficha__subtitulo">{subtitulo}</p>}
      </div>
      {children}
      {pie && <div className="ficha__pie">{pie}</div>}
    </Como>
  )
}
