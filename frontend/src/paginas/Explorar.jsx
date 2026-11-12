import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Boton from '../componentes/Boton.jsx'
import Buscador from '../componentes/Buscador.jsx'
import { Cargando, ErrorCarga, EsqueletoFichas } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import TarjetaPublicacion from '../componentes/TarjetaPublicacion.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { NARANJA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import './Explorar.css'

/*
 * / — Explorar publicaciones (LET-132, RF-15, CU-18). Pública, pleno naranja:
 * es lo que mira un tercero.
 *
 *   Franja   «Libros que buscan lector.» + la acción principal: publicar
 *            (con sesión) o crear una cuenta (sin sesión)
 *   Lienzo   Buscador por título o autor · grilla de tarjetas · Paginador
 *
 * Con sesión, las publicaciones propias vienen marcadas «Tuya» (`esMia`) y el
 * detalle no ofrece solicitarlas. La carga se repite al entrar o salir de la
 * sesión, porque `esMia` depende de quién mira.
 */
const PLENO = NARANJA
const POR_PAGINA = 12

export default function Explorar() {
  const navigate = useNavigate()
  const { usuario } = useSesion()
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)

  const carga = useCarga(
    () => obtener(conConsulta('/publicaciones', { q, pagina, porPagina: POR_PAGINA })),
    [q, pagina, usuario?.id],
  )

  const publicaciones = carga.datos?.datos ?? []
  const paginacion = carga.datos?.paginacion ?? { pagina, porPagina: POR_PAGINA, total: 0 }
  const total = paginacion.total
  const conteo = carga.datos
    ? `${total} ${total === 1 ? 'publicación' : 'publicaciones'}`
    : null

  function buscar(texto) {
    setQ(texto)
    setPagina(1)
  }

  return (
    <Marco
      pleno={PLENO}
      lema="Libros que *buscan* lector."
      tituloPagina="Explorar"
      accion={
        usuario ? (
          <Pastilla pleno={PLENO} onClick={() => navigate('/mis-libros')}>
            Publicar un libro
          </Pastilla>
        ) : (
          <Pastilla pleno={PLENO} onClick={() => navigate('/registro')}>
            Crear una cuenta
          </Pastilla>
        )
      }
    >
      <Buscador
        id="explorar-q"
        valor={q}
        alBuscar={buscar}
        placeholder="Por título o autor"
        extra={conteo}
      />

      <section aria-label="Publicaciones" aria-busy={carga.cargando || undefined}>
        {carga.cargando && <Cargando texto="Cargando publicaciones…" />}
        {carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar las publicaciones. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !carga.datos ? (
          <EsqueletoFichas />
        ) : publicaciones.length === 0 ? (
          q ? (
            <Vacio
              titulo={`Ninguna publicación coincide con «${q}»`}
              texto="Probá con otro título o autor."
              accion={<Boton onClick={() => buscar('')}>Limpiar búsqueda</Boton>}
            />
          ) : (
            <Vacio
              titulo="Todavía no hay publicaciones"
              texto="Cuando alguien publique un libro de su catálogo, va a aparecer acá."
              accion={
                usuario ? (
                  <Boton variante="naranja" tamano="grande" onClick={() => navigate('/mis-libros')}>
                    Publicar un libro
                  </Boton>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="grilla-fichas grilla-publicaciones">
            {publicaciones.map((publicacion) => (
              <TarjetaPublicacion key={publicacion.id} publicacion={publicacion} />
            ))}
          </div>
        )}
      </section>

      {carga.datos && total > 0 && (
        <Paginador
          pagina={paginacion.pagina}
          porPagina={paginacion.porPagina}
          total={total}
          alCambiar={setPagina}
        />
      )}
    </Marco>
  )
}
