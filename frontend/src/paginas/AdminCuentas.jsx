import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Aviso from '../componentes/Aviso.jsx'
import Boton from '../componentes/Boton.jsx'
import Buscador from '../componentes/Buscador.jsx'
import Campo from '../componentes/Campo.jsx'
import Chip from '../componentes/Chip.jsx'
import Dialogo from '../componentes/Dialogo.jsx'
import { Cargando, ErrorCarga, EsqueletoFilas } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { TINTA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { conConsulta, eliminar, enviar, ErrorApi, obtener } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import './AdminCuentas.css'

/*
 * /admin/cuentas — administración de cuentas (LET-41, RF-06, RF-07;
 * DISENIO-MODULO-2 §4.3). Pleno tinta: operativo. Va envuelta en RutaAdmin.
 *
 *   Franja   «Cuentas» + conteo · Buscador (nombre o correo) + filtro de estado
 *   Lienzo   tabla de papel: cuenta (nombre y correo), estado, sesiones
 *            activas, alta y acción · Paginador. A ≤600 px las filas pasan a
 *            tarjetas apiladas.
 *
 * Bloquear y desbloquear pasan por Dialogo con el nombre de la cuenta escrito
 * en la confirmación: es la defensa contra tocar la fila de al lado. Las
 * cuentas eliminadas no tienen acción, y la fila propia tampoco (un
 * administrador no puede bloquearse a sí mismo).
 *
 * Si la API contesta 403 ACCESO_DENEGADO (el rol cambió mientras tanto), se
 * vuelve a '/'.
 */
const PLENO = TINTA
const POR_PAGINA = 20

const FILTROS = [
  { valor: '', texto: 'Todos los estados' },
  { valor: 'activa', texto: 'Activas' },
  { valor: 'bloqueada', texto: 'Bloqueadas' },
  { valor: 'eliminada', texto: 'Eliminadas' },
]

export default function AdminCuentas() {
  const navigate = useNavigate()
  const { usuario } = useSesion()
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [accion, setAccion] = useState(null) // { cuenta, tipo: 'bloquear' | 'desbloquear' }
  const [aviso, setAviso] = useState(null)

  const carga = useCarga(
    () => obtener(conConsulta('/admin/cuentas', { q, estado, pagina, porPagina: POR_PAGINA })),
    [q, estado, pagina],
  )

  const denegado = carga.error instanceof ErrorApi && carga.error.codigo === 'ACCESO_DENEGADO'
  useEffect(() => {
    if (denegado) navigate('/', { replace: true })
  }, [denegado, navigate])

  const cuentas = carga.datos?.datos ?? []
  const paginacion = carga.datos?.paginacion ?? { pagina, porPagina: POR_PAGINA, total: 0 }
  const total = paginacion.total
  const hayFiltro = q !== '' || estado !== ''

  function buscar(texto) {
    setQ(texto)
    setPagina(1)
  }

  function filtrar(valor) {
    setEstado(valor)
    setPagina(1)
  }

  function limpiar() {
    setQ('')
    setEstado('')
    setPagina(1)
  }

  function alTerminar(cuenta, tipo) {
    setAccion(null)
    setAviso(
      tipo === 'bloquear'
        ? { titulo: `${cuenta.nombre} quedó bloqueada.`, texto: 'Sus sesiones activas se cerraron.' }
        : { titulo: `${cuenta.nombre} quedó desbloqueada.`, texto: 'Va a poder iniciar sesión de nuevo.' },
    )
    if (estado) {
      // El cambio puede sacar la cuenta del filtro de estado vigente.
      if (cuentas.length === 1 && pagina > 1) setPagina(pagina - 1)
      else carga.recargar()
    } else {
      carga.cambiarDatos((d) => ({
        ...d,
        datos: d.datos.map((c) => (c.id === cuenta.id ? { ...c, ...cuenta } : c)),
      }))
    }
  }

  return (
    <Marco
      pleno={PLENO}
      titulo="Cuentas"
      tituloPagina="Cuentas"
      sub={carga.datos ? `${total} ${total === 1 ? 'cuenta' : 'cuentas'}` : '\u00a0'}
      accion={
        <div className="admin__filtros">
          <Buscador
            id="admin-q"
            variante="oscuro"
            etiqueta="Buscar por nombre o correo"
            placeholder="Nombre o correo"
            valor={q}
            alBuscar={buscar}
          />
          <div className="admin__estado">
            <label htmlFor="admin-estado" className="solo-lector">
              Estado de la cuenta
            </label>
            <select
              id="admin-estado"
              className="admin__select"
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
        </div>
      }
    >
      {aviso && (
        <Aviso tipo="exito" titulo={aviso.titulo} alCerrar={() => setAviso(null)}>
          {aviso.texto}
        </Aviso>
      )}

      <section aria-label="Cuentas" aria-busy={carga.cargando || undefined}>
        {carga.cargando && <Cargando texto="Cargando las cuentas…" />}
        {carga.error ? (
          denegado ? null : (
            <ErrorCarga
              mensaje={mensajeDeError(
                carga.error,
                'No pudimos cargar las cuentas. Revisá tu conexión e intentá de nuevo.',
              )}
              alReintentar={carga.recargar}
            />
          )
        ) : !carga.datos ? (
          <EsqueletoFilas />
        ) : cuentas.length === 0 ? (
          hayFiltro ? (
            <Vacio
              titulo={q ? `Ninguna cuenta coincide con «${q}»` : 'Ninguna cuenta en ese estado'}
              texto="Probá con otro nombre o correo, o cambiá el filtro de estado."
              accion={<Boton onClick={limpiar}>Limpiar búsqueda</Boton>}
            />
          ) : (
            <Vacio titulo="Todavía no hay cuentas" texto="Cuando alguien se registre, aparece acá." />
          )
        ) : (
          <div className="papel admin__tabla" role="table" aria-label="Cuentas registradas">
            <div className="admin__fila admin__fila--cabecera" role="row">
              <span role="columnheader">Cuenta</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader" className="admin__num">
                Sesiones
              </span>
              <span role="columnheader">Alta</span>
              <span role="columnheader" className="admin__der">
                Acción
              </span>
            </div>
            {cuentas.map((cuenta) => (
              <FilaCuenta
                key={cuenta.id}
                cuenta={cuenta}
                esPropia={String(cuenta.id) === String(usuario?.id)}
                alAccionar={(tipo) => {
                  setAviso(null)
                  setAccion({ cuenta, tipo })
                }}
              />
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

      {accion && (
        <DialogoBloqueo
          cuenta={accion.cuenta}
          tipo={accion.tipo}
          alCerrar={() => setAccion(null)}
          alTerminar={alTerminar}
          alDenegado={() => navigate('/', { replace: true })}
        />
      )}
    </Marco>
  )
}

function FilaCuenta({ cuenta, esPropia, alAccionar }) {
  const eliminada = cuenta.estado === 'eliminada'
  const bloqueada = cuenta.estado === 'bloqueada'

  let accion
  if (eliminada) {
    accion = (
      <span className="admin__sin-accion" aria-label="Sin acción">
        —
      </span>
    )
  } else if (esPropia) {
    accion = <span className="admin__nota">sos vos</span>
  } else if (bloqueada) {
    accion = (
      <Boton tamano="chico" variante="verde" onClick={() => alAccionar('desbloquear')}>
        Desbloquear<span className="solo-lector"> a {cuenta.nombre}</span>
      </Boton>
    )
  } else {
    accion = (
      <Boton tamano="chico" variante="papel" onClick={() => alAccionar('bloquear')}>
        Bloquear<span className="solo-lector"> a {cuenta.nombre}</span>
      </Boton>
    )
  }

  return (
    <div className={`admin__fila ${eliminada ? 'admin__fila--eliminada' : ''}`.trim()} role="row">
      <span role="cell" className="admin__cuenta">
        <b className="admin__nombre">{cuenta.nombre}</b>
        <span className="admin__correo">{cuenta.email}</span>
      </span>
      <span role="cell" className="admin__chips">
        <Chip estado={cuenta.estado} />
        {cuenta.rol === 'administrador' && <Chip estado="administrador" />}
      </span>
      <span role="cell" className="admin__num">
        <span className="admin__etiqueta-movil">Sesiones activas: </span>
        {cuenta.sesionesActivas}
      </span>
      <span role="cell" className="admin__fecha">
        <span className="admin__etiqueta-movil">Alta: </span>
        {formatearFecha(cuenta.creadoEn)}
      </span>
      <span role="cell" className="admin__der admin__accion">
        {accion}
      </span>
    </div>
  )
}

/*
 * Confirmación de bloqueo o desbloqueo: hay que escribir el nombre de la
 * cuenta para habilitar el botón. Si la API falla, el diálogo queda abierto
 * con el motivo.
 */
function DialogoBloqueo({ cuenta, tipo, alCerrar, alTerminar, alDenegado }) {
  const bloquear = tipo === 'bloquear'
  const [escrito, setEscrito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const coincide = normalizar(escrito) === normalizar(cuenta.nombre)

  async function alEnviar(evento) {
    evento.preventDefault()
    if (!coincide) return
    setEnviando(true)
    setError(null)
    try {
      const ruta = `/admin/cuentas/${cuenta.id}/bloqueo`
      const respuesta = bloquear ? await enviar(ruta) : await eliminar(ruta)
      alTerminar(respuesta?.cuenta ?? { ...cuenta, estado: bloquear ? 'bloqueada' : 'activa' }, tipo)
    } catch (e) {
      setEnviando(false)
      if (e instanceof ErrorApi && e.codigo === 'ACCESO_DENEGADO') {
        alDenegado()
        return
      }
      setError(
        e instanceof ErrorApi && e.codigo !== 'SIN_RED'
          ? e.mensaje
          : 'La operación no pudo completarse. No se cambió nada: intentá de nuevo.',
      )
    }
  }

  return (
    <Dialogo
      abierto
      titulo={bloquear ? `¿Bloquear a ${cuenta.nombre}?` : `¿Desbloquear a ${cuenta.nombre}?`}
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={alEnviar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            No, volver
          </Boton>
          <Boton
            tipo="submit"
            variante={bloquear ? 'peligro' : 'verde'}
            disabled={!coincide}
            cargando={enviando}
            textoCargando={bloquear ? 'Bloqueando…' : 'Desbloqueando…'}
          >
            {bloquear ? 'Sí, bloquear' : 'Sí, desbloquear'}
          </Boton>
        </>
      }
    >
      {bloquear ? (
        <p className="dialogo__texto">
          No va a poder iniciar sesión y sus <b>sesiones activas</b> se cierran ahora.
        </p>
      ) : (
        <p className="dialogo__texto">
          Va a poder volver a iniciar sesión con su contraseña. Sus sesiones anteriores no se
          reactivan.
        </p>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo
        id="admin-confirmacion"
        etiqueta={`Escribí ${cuenta.nombre} para confirmar`}
        valor={escrito}
        alCambiar={(e) => setEscrito(e.target.value)}
        pleno={PLENO}
        autoComplete="off"
        spellCheck={false}
        disabled={enviando}
      />
    </Dialogo>
  )
}

function normalizar(texto) {
  return (texto || '').trim().toLocaleLowerCase('es')
}

/** '2026-09-21T…' -> '21/09/2026' */
function formatearFecha(iso) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
