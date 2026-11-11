import { Link } from 'react-router-dom'

import { lineaDeDatos, urlFoto } from '../servicios/libro.js'
import Reputacion from './Reputacion.jsx'
import './Ficha.css'
import './TarjetaPublicacion.css'

/*
 * Una publicación en un listado (LET-132): Explorar y el perfil público.
 * Mismo papel que la Ficha del catálogo, con la foto arriba.
 *
 *   foto (o la inicial del título si no hay)   -> lleva al detalle
 *   título · autor · «Editorial · Año · Estado»
 *   nota, entre comillas
 *   pie: el dueño con su reputación, o la marca «Tuya»
 *
 * No es un único enlace grande porque el nombre del dueño lleva a su perfil:
 * dos enlaces anidados no son HTML válido. Enlazan la foto y el título.
 *
 * props:
 *   publicacion   la forma de GET /api/publicaciones
 *   conDuenio?    bool  muestra el dueño en el pie (default true; el perfil
 *                       público lo apaga porque ya se sabe de quién es)
 */
export default function TarjetaPublicacion({ publicacion, conDuenio = true }) {
  const { id, libro, propietario, nota, tieneFoto, esMia } = publicacion
  const destino = `/publicaciones/${id}`
  const datos = lineaDeDatos(libro)

  return (
    <article className="ficha tarjeta-pub">
      <Link to={destino} className="tarjeta-pub__foto" tabIndex={-1} aria-hidden="true">
        {tieneFoto ? (
          <img src={urlFoto(id)} alt="" loading="lazy" />
        ) : (
          <span className="tarjeta-pub__inicial">{libro.titulo.trim().charAt(0)}</span>
        )}
      </Link>

      <div>
        <h3 className="ficha__titulo">
          <Link to={destino} className="tarjeta-pub__enlace">
            {libro.titulo}
          </Link>
        </h3>
        <p className="ficha__subtitulo">{libro.autor}</p>
        {datos && <p className="tarjeta-pub__datos">{datos}</p>}
      </div>

      {nota && <p className="tarjeta-pub__nota">«{nota}»</p>}

      {(conDuenio || esMia) && (
        <div className="ficha__pie">
          {conDuenio && (
            <span className="tarjeta-pub__duenio">
              <Link to={`/usuarios/${propietario.id}`} className="tarjeta-pub__enlace">
                {propietario.nombre}
              </Link>
              <Reputacion {...propietario.reputacion} conEstrellas={false} />
            </span>
          )}
          {esMia && <span className="tarjeta-pub__tuya">Tuya</span>}
        </div>
      )}
    </article>
  )
}
