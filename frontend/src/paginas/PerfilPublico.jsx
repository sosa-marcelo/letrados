import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import Boton from '../componentes/Boton.jsx'
import { Cargando, ErrorCarga, EsqueletoPapel } from '../componentes/Estados.jsx'
import { IconoEstrella } from '../componentes/Iconos.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Reputacion from '../componentes/Reputacion.jsx'
import TarjetaPublicacion from '../componentes/TarjetaPublicacion.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { NARANJA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, ErrorApi, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import './PerfilPublico.css'

/*
 * /usuarios/:id — perfil público (LET-40, RF-08; DISENIO-MODULO-2 §3.5).
 * Pleno naranja: es lo que ve un tercero. Pública: funciona con o sin
 * sesión (sin sesión, la barra ofrece «Entrar» y «Crear cuenta»).
 *
 *   Franja   inicial + nombre + Reputacion · cantidad de publicaciones
 *   Lienzo   publicaciones activas (TarjetaPublicacion, LET-135) · valoraciones recibidas
 *
 * Nunca muestra correo, rol ni estado: la API no los manda.
 *
 * Estados: esqueleto; error con «Reintentar»; 404 -> «No encontramos esa
 * cuenta»; cuenta eliminada (RF-09) -> «Cuenta eliminada», apagada y sin
 * publicaciones; vacío por bloque («Sin publicaciones activas», «Sin
 * valoraciones»).
 */
const PLENO = NARANJA

export default function PerfilPublico() {
  const { id } = useParams()
  const { usuario: sesion } = useSesion()
  const carga = useCarga(() => obtener(`/usuarios/${encodeURIComponent(id)}`).then((d) => d.usuario), [id])

  const noEncontrada = carga.error instanceof ErrorApi && carga.error.estado === 404
  const usuario = carga.datos
  const esPropio = Boolean(sesion && usuario && String(sesion.id) === String(usuario.id))

  // Encabezado de la franja según el estado.
  let encabezado
  let sub
  if (usuario) {
    const publicaciones = usuario.publicaciones?.length ?? 0
    encabezado = (
      <div className={`publico__encabezado ${usuario.eliminada ? 'publico__encabezado--eliminada' : ''}`.trim()}>
        <span className="publico__avatar" aria-hidden="true">
          {usuario.eliminada ? '—' : (usuario.nombre || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="publico__identidad">
          <h1 className="marco__titulo">{usuario.eliminada ? 'Cuenta eliminada' : usuario.nombre}</h1>
          <p className="publico__resumen">
            {usuario.eliminada ? (
              'Esta cuenta se dio de baja.'
            ) : (
              <>
                <Reputacion
                  promedio={usuario.reputacion?.promedio}
                  cantidad={usuario.reputacion?.cantidad}
                />
                <span>
                  {' '}
                  · {publicaciones} {publicaciones === 1 ? 'publicación activa' : 'publicaciones activas'}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    )
  } else if (noEncontrada) {
    encabezado = <h1 className="marco__titulo">Cuenta no encontrada</h1>
  } else {
    encabezado = (
      <h1 className="marco__titulo">
        <span className="solo-lector">Perfil público</span>
        <span className="publico__titulo-fantasma" aria-hidden="true" />
      </h1>
    )
  }
  if (esPropio) sub = 'Así ven tu perfil las demás personas.'

  return (
    <Marco
      pleno={PLENO}
      encabezado={encabezado}
      sub={sub}
      tituloPagina={usuario ? (usuario.eliminada ? 'Cuenta eliminada' : usuario.nombre) : 'Perfil'}
    >
      <div aria-busy={carga.cargando || undefined} className="publico__lienzo">
        {carga.cargando && !usuario && <Cargando texto="Cargando el perfil…" />}
        {noEncontrada ? (
          <section className="papel">
            <Vacio
              titulo="No encontramos esa cuenta"
              texto="Puede que el enlace esté mal escrito."
              accion={<Boton a="/">Ir al inicio</Boton>}
            />
          </section>
        ) : carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar este perfil. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !usuario ? (
          <EsqueletoPapel lineas={1} />
        ) : (
          <>
            <section className="papel" aria-labelledby="publico-publicaciones">
              <h2 id="publico-publicaciones" className="papel__titulo">
                Publicaciones activas
              </h2>
              {usuario.publicaciones?.length ? (
                <div className="grilla-fichas grilla-publicaciones">
                  {usuario.publicaciones.map((p) => (
                    <TarjetaPublicacion key={p.id} publicacion={p} conDuenio={false} />
                  ))}
                </div>
              ) : (
                <Vacio
                  como="h3"
                  titulo={usuario.eliminada ? 'Sin publicaciones activas' : 'Todavía no publicó libros'}
                  texto={
                    usuario.eliminada
                      ? 'Las cuentas eliminadas no publican.'
                      : 'Cuando publique un libro, lo vas a ver acá.'
                  }
                />
              )}
            </section>

            {!usuario.eliminada && (
              <section className="papel" aria-labelledby="publico-valoraciones">
                <h2 id="publico-valoraciones" className="papel__titulo">
                  Valoraciones
                </h2>
                <ValoracionesRecibidas usuarioId={usuario.id} />
              </section>
            )}
          </>
        )}
      </div>
    </Marco>
  )
}

const POR_PAGINA_VALORACIONES = 5

/*
 * Valoraciones recibidas (LET-168, RF-27, CU-29): puntaje, comentario, quién
 * la escribió y el intercambio que la habilitó, de la más nueva a la más
 * vieja. Sin valoraciones queda el vacío de siempre.
 */
function ValoracionesRecibidas({ usuarioId }) {
  const [pagina, setPagina] = useState(1)
  const carga = useCarga(
    () =>
      obtener(
        conConsulta(`/usuarios/${encodeURIComponent(usuarioId)}/valoraciones`, {
          pagina,
          porPagina: POR_PAGINA_VALORACIONES,
        }),
      ),
    [usuarioId, pagina],
  )

  if (carga.error) {
    return (
      <ErrorCarga
        mensaje={mensajeDeError(carga.error, 'No pudimos cargar las valoraciones.')}
        alReintentar={carga.recargar}
      />
    )
  }
  if (!carga.datos) return <EsqueletoPapel lineas={2} />

  const { datos, paginacion } = carga.datos
  if (paginacion.total === 0) {
    return (
      <Vacio
        como="h3"
        titulo="Sin valoraciones"
        texto="Las valoraciones aparecen cuando completa intercambios."
      />
    )
  }

  return (
    <>
      <ul className="valoraciones">
        {datos.map((v) => (
          <li key={v.id} className="valoracion">
            <span className="valoracion__estrellas" aria-label={`${v.puntaje} de 5 estrellas`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <IconoEstrella key={n} tam={15} llena={n <= v.puntaje} />
              ))}
            </span>
            {v.comentario && <p className="valoracion__comentario">«{v.comentario}»</p>}
            <p className="valoracion__pie">
              <Link to={`/usuarios/${v.autor.id}`} className="valoracion__autor">
                {v.autor.nombre}
              </Link>{' '}
              · por «{v.intercambio.libroSolicitado.titulo}» ⇄ «{v.intercambio.libroOfrecido.titulo}» ·{' '}
              {new Date(v.creadaEn).toLocaleDateString('es-PY')}
            </p>
          </li>
        ))}
      </ul>
      {paginacion.total > paginacion.porPagina && (
        <Paginador
          pagina={paginacion.pagina}
          porPagina={paginacion.porPagina}
          total={paginacion.total}
          alCambiar={setPagina}
        />
      )}
    </>
  )
}
