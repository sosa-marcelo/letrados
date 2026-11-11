import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Boton from '../componentes/Boton.jsx'
import Chip from '../componentes/Chip.jsx'
import { Cargando, ErrorCarga, EsqueletoFilas } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { VERDE } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import './Solicitudes.css'

/*
 * /solicitudes — recibidas y enviadas (LET-150, RF-18, CU-21). Con sesión,
 * pleno verde: es lo propio.
 *
 *   Franja   «Tus intercambios.»
 *   Lienzo   pestañas Recibidas / Enviadas · filtro por estado · filas ·
 *            Paginador
 *
 * Cada fila dice, desde quien mira, qué libro da y cuál recibe, con quién,
 * en qué estado está y, si está aceptada, hasta cuándo hay para confirmar.
 * Las acciones (aceptar, rechazar, cancelar, confirmar) llegan con LET-151 y
 * se dibujan según `puedo`, que manda la API.
 */
const PLENO = VERDE
const POR_PAGINA = 10

const FILTROS = [
  { valor: '', texto: 'Todos los estados' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aceptada', texto: 'Aceptadas' },
  { valor: 'flagueada', texto: 'Flagueadas' },
  { valor: 'completada', texto: 'Completadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
]

const PESTANAS = [
  { valor: 'recibidas', texto: 'Recibidas' },
  { valor: 'enviadas', texto: 'Enviadas' },
]

/** «13/11, 10:30» en la hora local. */
export function fechaCorta(iso) {
  return new Date(iso).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Solicitudes() {
  const navigate = useNavigate()
  const [rol, setRol] = useState('recibidas')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)

  const carga = useCarga(
    () => obtener(conConsulta('/solicitudes', { rol, estado, pagina, porPagina: POR_PAGINA })),
    [rol, estado, pagina],
  )

  const solicitudes = carga.datos?.datos ?? []
  const paginacion = carga.datos?.paginacion ?? { pagina, porPagina: POR_PAGINA, total: 0 }
  const total = paginacion.total

  function cambiarRol(nuevo) {
    setRol(nuevo)
    setPagina(1)
  }

  function filtrar(nuevo) {
    setEstado(nuevo)
    setPagina(1)
  }

  return (
    <Marco pleno={PLENO} lema="Tus *intercambios*." tituloPagina="Solicitudes">
      <div className="papel solicitudes__barra">
        <div className="solicitudes__pestanas" role="tablist" aria-label="Qué solicitudes ver">
          {PESTANAS.map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              aria-selected={rol === p.valor}
              className={`solicitudes__pestana ${rol === p.valor ? 'solicitudes__pestana--activa' : ''}`.trim()}
              onClick={() => cambiarRol(p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <label htmlFor="solicitudes-estado" className="solo-lector">
          Estado de la solicitud
        </label>
        <select
          id="solicitudes-estado"
          className="solicitudes__select"
          value={estado}
          onChange={(e) => filtrar(e.target.value)}
        >
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.texto}
            </option>
          ))}
        </select>
      </div>

      <section aria-label={rol === 'recibidas' ? 'Solicitudes recibidas' : 'Solicitudes enviadas'} aria-busy={carga.cargando || undefined}>
        {carga.cargando && <Cargando texto="Cargando solicitudes…" />}
        {carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar tus solicitudes. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !carga.datos ? (
          <EsqueletoFilas />
        ) : solicitudes.length === 0 ? (
          estado ? (
            <Vacio
              titulo="Ninguna solicitud en ese estado"
              texto="Probá con otro filtro."
              accion={<Boton onClick={() => filtrar('')}>Ver todas</Boton>}
            />
          ) : rol === 'recibidas' ? (
            <Vacio
              titulo="Todavía no hay solicitudes"
              texto="Cuando alguien pida uno de tus libros publicados, la vas a ver acá."
              accion={<Boton onClick={() => navigate('/mis-libros')}>Ir a Mis libros</Boton>}
            />
          ) : (
            <Vacio
              titulo="Todavía no enviaste solicitudes"
              texto="Buscá un libro en Explorar y ofrecé uno tuyo a cambio."
              accion={
                <Boton variante="naranja" onClick={() => navigate('/')}>
                  Ir a Explorar
                </Boton>
              }
            />
          )
        ) : (
          <ul className="solicitudes__lista">
            {solicitudes.map((solicitud) => (
              <FilaSolicitud key={solicitud.id} solicitud={solicitud} />
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

/** Una solicitud, contada desde quien mira. */
function FilaSolicitud({ solicitud, children }) {
  const { soyPropietario, contraparte, libroSolicitado, libroOfrecido, estado } = solicitud
  const doy = soyPropietario ? libroSolicitado : libroOfrecido
  const recibo = soyPropietario ? libroOfrecido : libroSolicitado
  const enCurso = estado === 'aceptada' || estado === 'flagueada'

  return (
    <li className="papel solicitud">
      <div className="solicitud__cabecera">
        <Chip estado={estado} />
        <span className="solicitud__con">
          {soyPropietario ? 'Te la pidió ' : 'Se la pediste a '}
          <Link to={`/usuarios/${contraparte.id}`} className="solicitud__enlace">
            {contraparte.nombre}
          </Link>
        </span>
        <span className="solicitud__fecha">{fechaCorta(solicitud.creadaEn)}</span>
      </div>

      <div className="solicitud__libros">
        <div>
          <span className="solicitud__etiqueta">Das</span>
          <span className="solicitud__titulo">{doy.titulo}</span>
          <span className="solicitud__autor">{doy.autor}</span>
        </div>
        <span className="solicitud__flecha" aria-hidden="true">
          ⇄
        </span>
        <div>
          <span className="solicitud__etiqueta">Recibís</span>
          <span className="solicitud__titulo">{recibo.titulo}</span>
          <span className="solicitud__autor">{recibo.autor}</span>
        </div>
      </div>

      {enCurso && (
        <p className="solicitud__estado">
          {estado === 'flagueada'
            ? 'Venció el plazo sin la confirmación de ambas partes.'
            : `Confirmen el intercambio antes del ${fechaCorta(solicitud.venceEn)}.`}{' '}
          {solicitud.confirmadaPorMi ? 'Vos ya confirmaste.' : 'Te falta confirmar.'}{' '}
          {solicitud.confirmadaPorContraparte
            ? `${contraparte.nombre} ya confirmó.`
            : `${contraparte.nombre} todavía no confirmó.`}
        </p>
      )}

      <div className="solicitud__pie">
        <Link to={`/publicaciones/${solicitud.publicacionId}`} className="solicitud__enlace">
          Ver la publicación
        </Link>
        {children}
      </div>
    </li>
  )
}

export { FilaSolicitud }
