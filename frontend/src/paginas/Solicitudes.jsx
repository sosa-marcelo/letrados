import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Aviso from '../componentes/Aviso.jsx'
import Boton from '../componentes/Boton.jsx'
import Campo from '../componentes/Campo.jsx'
import Chip from '../componentes/Chip.jsx'
import Dialogo from '../componentes/Dialogo.jsx'
import { Cargando, ErrorCarga, EsqueletoFilas } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { VERDE } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, enviar, obtener } from '../servicios/cliente.js'
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
 * Las acciones (LET-151: aceptar, rechazar, cancelar, confirmar) se dibujan
 * según `puedo`, que manda la API con las mismas reglas que las valida. Cada
 * una pide confirmación; después se recarga la página, porque aceptar también
 * rechaza las demás pendientes sobre la publicación.
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

/** «13/11, 14:30» en la hora local, en 24 h (sin «p. m.» que choque con el punto final). */
export function fechaCorta(iso) {
  return new Date(iso).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function Solicitudes() {
  const navigate = useNavigate()
  const [rol, setRol] = useState('recibidas')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aviso, setAviso] = useState(null)
  const [accion, setAccion] = useState(null) // { tipo, solicitud }

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

  function alTerminar(tipo, solicitud) {
    setAccion(null)
    setAviso(textoDelAviso(tipo, solicitud))
    carga.recargar()
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

      {aviso && (
        <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
          <b>{aviso}</b>
        </Aviso>
      )}

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
              <FilaSolicitud key={solicitud.id} solicitud={solicitud}>
                <AccionesSolicitud
                  solicitud={solicitud}
                  alElegir={(tipo) => {
                    setAviso(null)
                    setAccion({ tipo, solicitud })
                  }}
                />
              </FilaSolicitud>
            ))}
          </ul>
        )}
      </section>

      {accion?.tipo === 'reportar' && (
        <DialogoReporte
          solicitud={accion.solicitud}
          alCerrar={() => setAccion(null)}
          alEnviar={() => {
            setAccion(null)
            setAviso('Enviamos tu reporte. Lo revisa el equipo de administración.')
          }}
        />
      )}

      {accion && accion.tipo !== 'reportar' && (
        <DialogoAccion
          {...accion}
          alCerrar={() => setAccion(null)}
          alTerminar={alTerminar}
        />
      )}

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


/** Los botones que la API habilita para esta solicitud (`puedo`). */
function AccionesSolicitud({ solicitud, alElegir }) {
  const { puedo } = solicitud
  if (!puedo.aceptar && !puedo.rechazar && !puedo.confirmar && !puedo.cancelar && !puedo.reportar) {
    return null
  }
  return (
    <span className="solicitud__acciones">
      {puedo.aceptar && (
        <Boton tamano="chico" variante="naranja" onClick={() => alElegir('aceptar')}>
          Aceptar
        </Boton>
      )}
      {puedo.confirmar && (
        <Boton tamano="chico" variante="naranja" onClick={() => alElegir('confirmar')}>
          Confirmar entrega
        </Boton>
      )}
      {puedo.rechazar && (
        <Boton tamano="chico" onClick={() => alElegir('rechazar')}>
          Rechazar
        </Boton>
      )}
      {puedo.reportar && (
        <Boton tamano="chico" onClick={() => alElegir('reportar')}>
          Reportar un inconveniente
        </Boton>
      )}
      {puedo.cancelar && (
        <Boton tamano="chico" variante="peligro" onClick={() => alElegir('cancelar')}>
          Cancelar
        </Boton>
      )}
    </span>
  )
}

/** Qué se le dice a la persona en cada diálogo. */
function textosDe(tipo, solicitud) {
  const { contraparte, soyPropietario, libroSolicitado, libroOfrecido, estado } = solicitud
  const doy = soyPropietario ? libroSolicitado : libroOfrecido
  const recibo = soyPropietario ? libroOfrecido : libroSolicitado
  switch (tipo) {
    case 'aceptar':
      return {
        titulo: '¿Aceptar la solicitud?',
        texto: `Le das «${doy.titulo}» a ${contraparte.nombre} y recibís «${recibo.titulo}». Se reserva un ejemplar de cada libro, la publicación sale de Explorar y se rechazan las demás solicitudes pendientes sobre ella.`,
        boton: 'Sí, aceptar',
        variante: 'naranja',
      }
    case 'rechazar':
      return {
        titulo: '¿Rechazar la solicitud?',
        texto: `${contraparte.nombre} va a ver la solicitud rechazada. Tu publicación sigue en Explorar.`,
        boton: 'Sí, rechazar',
        variante: 'peligro',
      }
    case 'cancelar':
      return {
        titulo: '¿Cancelar la operación?',
        texto:
          estado === 'pendiente'
            ? 'La solicitud se cierra y no se reserva nada.'
            : 'Se liberan los dos ejemplares reservados y la publicación vuelve a Explorar.',
        boton: 'Sí, cancelar',
        variante: 'peligro',
      }
    default:
      return {
        titulo: '¿Ya se hizo el intercambio?',
        texto: solicitud.confirmadaPorContraparte
          ? `Confirmalo cuando tengas «${recibo.titulo}» en tus manos. ${contraparte.nombre} ya confirmó: con tu confirmación queda completado.`
          : `Confirmalo cuando tengas «${recibo.titulo}» en tus manos. Se completa cuando ${contraparte.nombre} también confirme.`,
        boton: 'Sí, confirmar',
        variante: 'naranja',
      }
  }
}

/** El aviso después de cada acción, con la solicitud como quedó. */
function textoDelAviso(tipo, solicitud) {
  const nombre = solicitud.contraparte.nombre
  if (tipo === 'aceptar') {
    return `Aceptaste la solicitud de ${nombre}. Coordinen la entrega y confirmen antes del ${fechaCorta(solicitud.venceEn)}.`
  }
  if (tipo === 'rechazar') return `Rechazaste la solicitud de ${nombre}.`
  if (tipo === 'cancelar') return 'Cancelaste la operación.'
  return solicitud.estado === 'completada'
    ? `El intercambio con ${nombre} se completó.`
    : `Confirmaste la entrega. Falta que ${nombre} confirme.`
}

/*
 * Confirmación de una acción. Si el servidor contesta 409 (algo cambió entre
 * la carga y el clic), muestra el motivo y no se cierra.
 */
function DialogoAccion({ tipo, solicitud, alCerrar, alTerminar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const textos = textosDe(tipo, solicitud)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      const { solicitud: nueva } = await enviar(`/solicitudes/${solicitud.id}/${tipo}`)
      alTerminar(tipo, nueva)
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
    }
  }

  return (
    <Dialogo
      abierto
      titulo={textos.titulo}
      alCerrar={alCerrar}
      ocupado={enviando}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando} data-autofoco>
            No, volver
          </Boton>
          <Boton variante={textos.variante} onClick={confirmar} cargando={enviando} textoCargando="Un momento…">
            {textos.boton}
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">{textos.texto}</p>
    </Dialogo>
  )
}

const LARGO_REPORTE = 1000

/*
 * Reportar un inconveniente (LET-159, RF-24, CU-26): solo con el intercambio
 * flagueado. El reporte queda vinculado al intercambio y a quien lo escribió,
 * y el administrador lo lee en /admin/flagueados.
 */
function DialogoReporte({ solicitud, alCerrar, alEnviar }) {
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [errorCampo, setErrorCampo] = useState(null)

  async function confirmar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    setErrorCampo(null)
    try {
      await enviar(`/solicitudes/${solicitud.id}/reportes`, { descripcion })
      alEnviar()
    } catch (e) {
      setEnviando(false)
      const delCampo = e?.detalles?.find?.((d) => d.campo === 'descripcion')
      if (delCampo) setErrorCampo(delCampo.mensaje)
      else setError(mensajeDeError(e))
    }
  }

  return (
    <Dialogo
      abierto
      titulo="Reportar un inconveniente"
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={confirmar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            Descartar
          </Boton>
          <Boton tipo="submit" variante="naranja" cargando={enviando} textoCargando="Enviando…">
            Enviar reporte
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">
        Venció el plazo sin la confirmación de ambas partes. Contá qué pasó con el intercambio con{' '}
        <b>{solicitud.contraparte.nombre}</b>: lo lee el equipo de administración.
      </p>
      <Campo
        id="reporte-descripcion"
        etiqueta="Qué pasó"
        elemento="textarea"
        valor={descripcion}
        alCambiar={(e) => setDescripcion(e.target.value)}
        error={errorCampo}
        pista={`${descripcion.length}/${LARGO_REPORTE}`}
        pleno={PLENO}
        disabled={enviando}
        maxLength={LARGO_REPORTE}
        rows={5}
        required
      />
    </Dialogo>
  )
}
