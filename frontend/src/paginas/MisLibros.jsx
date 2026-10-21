import { useState } from 'react'

import Aviso from '../componentes/Aviso.jsx'
import Boton from '../componentes/Boton.jsx'
import Buscador from '../componentes/Buscador.jsx'
import Campo from '../componentes/Campo.jsx'
import Dialogo from '../componentes/Dialogo.jsx'
import { Cargando, ErrorCarga, EsqueletoFichas } from '../componentes/Estados.jsx'
import Ficha from '../componentes/Ficha.jsx'
import Marco from '../componentes/Marco.jsx'
import Paginador from '../componentes/Paginador.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { VERDE } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { actualizar, conConsulta, eliminar, enviar, ErrorApi, obtener } from '../servicios/cliente.js'
import { mapearDetalles, mensajeDeError } from '../servicios/errores.js'
import './MisLibros.css'

/*
 * /mis-libros — catálogo propio (LET-43, DISENIO-MODULO-3 §4). Pleno verde.
 *
 *   Franja   «Tu biblioteca.» + «Agregar un libro»
 *   Lienzo   Buscador por título o autor (300 ms) · grilla de fichas con los
 *            tres números (disponible destacado) · Paginador
 *
 * Los cuatro estados: esqueleto de fichas la primera vez; error con
 * «Reintentar»; vacío («Tu catálogo está vacío» o «Ningún libro coincide…»
 * si hay búsqueda); y la grilla.
 *
 * «Publicar» es del módulo 4 (ciclo 3): se dibuja deshabilitado, con la
 * pista «Sin ejemplares disponibles» si no hay disponibles.
 */
const PLENO = VERDE
const POR_PAGINA = 12

export default function MisLibros() {
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aviso, setAviso] = useState(null) // éxito de la última operación
  const [formulario, setFormulario] = useState(null) // { libro? } abierto
  const [retiro, setRetiro] = useState(null) // libro a retirar

  const carga = useCarga(
    () => obtener(conConsulta('/libros', { q, pagina, porPagina: POR_PAGINA })),
    [q, pagina],
  )

  const libros = carga.datos?.datos ?? []
  const paginacion = carga.datos?.paginacion ?? { pagina, porPagina: POR_PAGINA, total: 0 }

  function buscar(texto) {
    setQ(texto)
    setPagina(1)
  }

  function abrirAlta() {
    setAviso(null)
    setFormulario({ libro: null })
  }

  // Alta: se recarga la página 1 (el libro nuevo va primero, orden por fecha).
  // Edición: se reemplaza la ficha en el lugar.
  function alGuardar(libro, eraAlta) {
    setFormulario(null)
    if (eraAlta) {
      setAviso(`«${libro.titulo}» se agregó a tu catálogo.`)
      if (pagina === 1 && q === '') carga.recargar()
      else {
        setQ('')
        setPagina(1)
      }
    } else {
      setAviso(`Guardamos los cambios de «${libro.titulo}».`)
      carga.cambiarDatos((d) => ({
        ...d,
        datos: d.datos.map((l) => (l.id === libro.id ? { ...l, ...libro } : l)),
      }))
    }
  }

  function alRetirar(libro, resultado) {
    setRetiro(null)
    setAviso(
      resultado === 'archivado'
        ? `«${libro.titulo}» se archivó: sale de tu catálogo y queda en el historial.`
        : `«${libro.titulo}» se eliminó de tu catálogo.`,
    )
    // Si era el último de la página, retroceder una.
    if (libros.length === 1 && pagina > 1) setPagina(pagina - 1)
    else carga.recargar()
  }

  const total = paginacion.total
  const conteo = carga.datos ? `${total} ${total === 1 ? 'libro' : 'libros'}` : null

  return (
    <Marco
      pleno={PLENO}
      lema="Tu *biblioteca*."
      tituloPagina="Mis libros"
      accion={
        <Pastilla pleno={PLENO} onClick={abrirAlta}>
          Agregar un libro
        </Pastilla>
      }
    >
      <Buscador
        id="mis-libros-q"
        valor={q}
        alBuscar={buscar}
        placeholder="Por título o autor"
        extra={conteo}
      />

      {aviso && (
        <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
          <b>{aviso}</b>
        </Aviso>
      )}

      <section aria-label="Tus libros" aria-busy={carga.cargando || undefined}>
        {carga.cargando && <Cargando texto="Cargando tu catálogo…" />}
        {carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar tu catálogo. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !carga.datos ? (
          <EsqueletoFichas />
        ) : libros.length === 0 ? (
          q ? (
            <Vacio
              titulo={`Ningún libro coincide con «${q}»`}
              texto="Probá con otro título o autor."
              accion={<Boton onClick={() => buscar('')}>Limpiar búsqueda</Boton>}
            />
          ) : (
            <Vacio
              titulo="Tu catálogo está vacío"
              texto="Cargá el primer libro de tu biblioteca."
              accion={
                <Boton variante="naranja" tamano="grande" onClick={abrirAlta}>
                  Agregar un libro
                </Boton>
              }
            />
          )
        ) : (
          <div className="grilla-fichas">
            {libros.map((libro) => (
              <FichaLibro
                key={libro.id}
                libro={libro}
                alEditar={() => {
                  setAviso(null)
                  setFormulario({ libro })
                }}
                alRetirar={() => {
                  setAviso(null)
                  setRetiro(libro)
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

      {formulario && (
        <DialogoLibro
          libro={formulario.libro}
          alCerrar={() => setFormulario(null)}
          alGuardar={alGuardar}
        />
      )}

      {retiro && (
        <DialogoRetiro libro={retiro} alCerrar={() => setRetiro(null)} alRetirar={alRetirar} />
      )}
    </Marco>
  )
}

/** Una ficha del catálogo con los tres números. */
function FichaLibro({ libro, alEditar, alRetirar }) {
  const sinDisponibles = libro.disponible <= 0
  const pistaPublicar = sinDisponibles ? 'Sin ejemplares disponibles' : 'Disponible en el próximo ciclo'

  return (
    <Ficha
      titulo={libro.titulo}
      subtitulo={libro.autor}
      atenuada={sinDisponibles}
      pie={
        <>
          <span className="libro__acciones">
            <button type="button" className="libro__enlace" onClick={alEditar}>
              Editar
            </button>
            <span className="libro__punto" aria-hidden="true">
              ·
            </span>
            <button type="button" className="libro__enlace" onClick={alRetirar}>
              Retirar
            </button>
          </span>
          <span className="libro__publicar">
            {sinDisponibles && <span className="libro__pista">{pistaPublicar}</span>}
            <Boton tamano="chico" disabled title={pistaPublicar}>
              {libro.publicado ? 'Ver publicación' : 'Publicar'}
            </Boton>
          </span>
        </>
      }
    >
      <div className="libro__numeros">
        <span className={`libro__disponible ${sinDisponibles ? 'libro__disponible--cero' : ''}`.trim()}>
          {libro.disponible}
        </span>
        <span className="libro__detalle">
          {libro.disponible} {libro.disponible === 1 ? 'disponible' : 'disponibles'}
          <br />
          <span className="libro__detalle-chico">
            {libro.total} {libro.total === 1 ? 'total' : 'totales'} · {libro.reservada}{' '}
            {libro.reservada === 1 ? 'reservado' : 'reservados'}
          </span>
        </span>
      </div>
    </Ficha>
  )
}

/*
 * Alta y edición en el mismo formulario (tres campos). En edición, si hay
 * reservas, la cantidad no puede bajar de `reservada`: la pista lo dice y el
 * botón se deshabilita por debajo — el mismo límite que exige el servidor.
 */
function DialogoLibro({ libro, alCerrar, alGuardar }) {
  const esAlta = !libro
  const minimo = esAlta ? 1 : Math.max(1, libro.reservada)

  const [titulo, setTitulo] = useState(libro?.titulo ?? '')
  const [autor, setAutor] = useState(libro?.autor ?? '')
  const [cantidad, setCantidad] = useState(String(libro?.total ?? 1))
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  const numero = Number(cantidad)
  const bajoReservas = !esAlta && libro.reservada > 0 && cantidad !== '' && numero < libro.reservada
  const pistaReservas =
    !esAlta && libro.reservada > 0
      ? `Mínimo ${libro.reservada}: tenés ${libro.reservada} ${libro.reservada === 1 ? 'reservado' : 'reservados'}.`
      : undefined

  async function alEnviar(evento) {
    evento.preventDefault()
    if (bajoReservas) return
    setEnviando(true)
    setErrorGeneral(null)
    setErroresCampo({})
    const cuerpo = { titulo, autor, cantidad: cantidad === '' ? cantidad : numero }
    try {
      const { libro: guardado } = esAlta
        ? await enviar('/libros', cuerpo)
        : await actualizar(`/libros/${libro.id}`, cuerpo)
      alGuardar(guardado, esAlta)
    } catch (error) {
      setEnviando(false)
      if (error instanceof ErrorApi && error.codigo === 'DATOS_INVALIDOS' && error.detalles.length) {
        setErroresCampo(mapearDetalles(error.detalles))
      } else {
        setErrorGeneral(mensajeDeError(error))
      }
    }
  }

  return (
    <Dialogo
      abierto
      titulo={esAlta ? 'Agregar un libro' : 'Editar libro'}
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={alEnviar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            Descartar
          </Boton>
          <Boton
            tipo="submit"
            variante="naranja"
            cargando={enviando}
            textoCargando={esAlta ? 'Agregando…' : 'Guardando…'}
            disabled={bajoReservas}
          >
            {esAlta ? 'Agregar' : 'Guardar'}
          </Boton>
        </>
      }
    >
      {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}
      <Campo
        id="libro-titulo"
        etiqueta="Título"
        valor={titulo}
        alCambiar={(e) => setTitulo(e.target.value)}
        error={erroresCampo.titulo}
        pleno={PLENO}
        disabled={enviando}
        maxLength={200}
        required
      />
      <Campo
        id="libro-autor"
        etiqueta="Autor"
        valor={autor}
        alCambiar={(e) => setAutor(e.target.value)}
        error={erroresCampo.autor}
        pleno={PLENO}
        disabled={enviando}
        maxLength={200}
        required
      />
      <div className="libro__campo-cantidad">
        <Campo
          id="libro-cantidad"
          etiqueta="Ejemplares"
          tipo="number"
          inputMode="numeric"
          min={minimo}
          step={1}
          valor={cantidad}
          alCambiar={(e) => setCantidad(e.target.value)}
          error={erroresCampo.cantidad || (bajoReservas ? pistaReservas : undefined)}
          pista={bajoReservas ? undefined : pistaReservas}
          pleno={PLENO}
          disabled={enviando}
          required
        />
      </div>
    </Dialogo>
  )
}

/*
 * Retiro. El texto depende de si el libro tiene historial, porque el
 * resultado es distinto (se elimina o se archiva). Si el servidor contesta
 * 409 igual —algo cambió entre la carga y el clic—, el diálogo muestra el
 * motivo y no se cierra.
 */
function DialogoRetiro({ libro, alCerrar, alRetirar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await eliminar(`/libros/${libro.id}`)
      alRetirar(libro, respuesta?.resultado)
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
    }
  }

  return (
    <Dialogo
      abierto
      titulo="¿Retirar el libro?"
      alCerrar={alCerrar}
      ocupado={enviando}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando} data-autofoco>
            No, volver
          </Boton>
          <Boton
            variante="peligro"
            onClick={confirmar}
            cargando={enviando}
            textoCargando="Retirando…"
          >
            {libro.tieneHistorial ? 'Sí, archivar' : 'Sí, eliminar'}
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      {libro.tieneHistorial ? (
        <p className="dialogo__texto">
          <b>{libro.titulo}</b> participó en intercambios completados. Se archiva en lugar de
          eliminarse, para conservar el historial.
        </p>
      ) : (
        <p className="dialogo__texto">
          Se va a eliminar <b>{libro.titulo}</b> de tu catálogo.
        </p>
      )}
    </Dialogo>
  )
}
