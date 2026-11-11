import { useState } from 'react'
import { Link } from 'react-router-dom'

import Boton from '../componentes/Boton.jsx'
import Chip from '../componentes/Chip.jsx'
import { Cargando, ErrorCarga, EsqueletoFilas } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { TINTA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import { fechaCorta } from './Solicitudes.jsx'
import './AdminFlagueados.css'

/*
 * /admin/flagueados — intercambios flagueados (LET-160, RF-23, RF-24, CU-27).
 * Solo administradores, pleno tinta: es lo operativo.
 *
 *   Franja   «Flagueados» + conteo · filtro «Siguen flagueados» / «Todos»
 *   Lienzo   un papel por intercambio: las dos partes, los dos libros,
 *            «Flagueado el», el estado actual y, desplegables, sus reportes
 *
 * El administrador solo consulta: RF-23 y RF-24 no le dan acciones. Ver
 * «Todos» sirve para saber cómo terminó cada uno (completado o cancelado).
 */
const PLENO = TINTA
const POR_PAGINA = 10

export default function AdminFlagueados() {
  const [estado, setEstado] = useState('flagueada')
  const [pagina, setPagina] = useState(1)

  const carga = useCarga(
    () => obtener(conConsulta('/admin/flagueados', { estado, pagina, porPagina: POR_PAGINA })),
    [estado, pagina],
  )

  const intercambios = carga.datos?.datos ?? []
  const paginacion = carga.datos?.paginacion ?? { pagina, porPagina: POR_PAGINA, total: 0 }
  const total = paginacion.total

  function filtrar(nuevo) {
    setEstado(nuevo)
    setPagina(1)
  }

  return (
    <Marco
      pleno={PLENO}
      titulo="Flagueados"
      tituloPagina="Flagueados"
      sub={
        carga.datos
          ? `${total} ${total === 1 ? 'intercambio' : 'intercambios'} ${estado === 'todos' ? 'flagueados alguna vez' : 'sin confirmar'}`
          : ' '
      }
      accion={
        <div className="flagueados__filtro">
          <label htmlFor="flagueados-estado" className="solo-lector">
            Qué intercambios ver
          </label>
          <select
            id="flagueados-estado"
            className="flagueados__select"
            value={estado}
            onChange={(e) => filtrar(e.target.value)}
          >
            <option value="flagueada">Siguen flagueados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      }
    >
      <section aria-label="Intercambios flagueados" aria-busy={carga.cargando || undefined}>
        {carga.cargando && <Cargando texto="Cargando intercambios…" />}
        {carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar los intercambios. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !carga.datos ? (
          <EsqueletoFilas />
        ) : intercambios.length === 0 ? (
          <Vacio
            titulo={estado === 'todos' ? 'Ningún intercambio se flagueó' : 'No hay intercambios flagueados'}
            texto="Aparecen acá cuando vence el plazo sin la confirmación de ambas partes."
            accion={
              estado !== 'todos' ? <Boton onClick={() => filtrar('todos')}>Ver todos</Boton> : undefined
            }
          />
        ) : (
          <ul className="flagueados__lista">
            {intercambios.map((intercambio) => (
              <FilaFlagueado key={intercambio.id} intercambio={intercambio} />
            ))}
          </ul>
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

/** Un intercambio flagueado con sus reportes desplegables. */
function FilaFlagueado({ intercambio }) {
  const { propietario, solicitante, libroSolicitado, libroOfrecido, reportes } = intercambio
  return (
    <li className="papel flagueado">
      <div className="flagueado__cabecera">
        <Chip estado={intercambio.estado} />
        <span className="flagueado__fecha">Flagueado el {fechaCorta(intercambio.flagueadaEn)}</span>
      </div>

      <div className="flagueado__partes">
        <Parte rol="Publicó" persona={propietario} libro={libroSolicitado} />
        <span className="flagueado__flecha" aria-hidden="true">
          ⇄
        </span>
        <Parte rol="Solicitó" persona={solicitante} libro={libroOfrecido} />
      </div>

      <p className="flagueado__motivo">{intercambio.motivo}</p>

      {reportes.length === 0 ? (
        <p className="flagueado__sin-reportes">Ninguna de las partes reportó un inconveniente.</p>
      ) : (
        <details className="flagueado__reportes">
          <summary>
            {reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'}
          </summary>
          <ul>
            {reportes.map((reporte) => (
              <li key={reporte.id} className="flagueado__reporte">
                <span className="flagueado__autor">
                  {reporte.autor.nombre} · {fechaCorta(reporte.creadoEn)}
                </span>
                <p>{reporte.descripcion}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

/** Una de las partes con el libro que puso en el intercambio. */
function Parte({ rol, persona, libro }) {
  return (
    <div>
      <span className="flagueado__etiqueta">{rol}</span>
      <Link to={`/usuarios/${persona.id}`} className="flagueado__persona">
        {persona.nombre}
      </Link>
      <span className="flagueado__libro">
        «{libro.titulo}» · {libro.autor}
      </span>
    </div>
  )
}
