import { useParams } from 'react-router-dom'

import Boton from '../componentes/Boton.jsx'
import { Cargando, ErrorCarga, EsqueletoPapel } from '../componentes/Estados.jsx'
import Ficha from '../componentes/Ficha.jsx'
import Marco from '../componentes/Marco.jsx'
import Reputacion from '../componentes/Reputacion.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { NARANJA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { ErrorApi, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import './PerfilPublico.css'

/*
 * /usuarios/:id — perfil público (LET-40, RF-08; DISENIO-MODULO-2 §3.5).
 * Pleno naranja: es lo que ve un tercero. Pública: funciona con o sin
 * sesión (sin sesión, la barra ofrece «Entrar» y «Crear cuenta»).
 *
 *   Franja   inicial + nombre + Reputacion · cantidad de publicaciones
 *   Lienzo   publicaciones activas (Ficha) · valoraciones recibidas
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
                <div className="grilla-fichas">
                  {usuario.publicaciones.map((p) => (
                    <Ficha key={p.id} titulo={p.titulo} subtitulo={p.autor} />
                  ))}
                </div>
              ) : (
                <Vacio
                  como="h3"
                  titulo="Sin publicaciones activas"
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
                {/* Las valoraciones llegan con el módulo 5; hasta entonces la
                    API no las manda y la reputación vale «Sin valoraciones». */}
                <Vacio
                  como="h3"
                  titulo="Sin valoraciones"
                  texto="Las valoraciones aparecen cuando completa intercambios."
                />
              </section>
            )}
          </>
        )}
      </div>
    </Marco>
  )
}
