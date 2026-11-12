import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import {
  actualizar,
  conConsulta,
  eliminar,
  enviar,
  ErrorApi,
  obtener,
  subirArchivo,
} from '../servicios/cliente.js'
import { mapearDetalles, mensajeDeError } from '../servicios/errores.js'
import { ESTADOS_CONSERVACION, lineaDeDatos } from '../servicios/libro.js'
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
 * «Publicar» (LET-134, RF-14, CU-16) abre un diálogo con nota y foto
 * opcionales y lleva al detalle de la publicación nueva. Sin ejemplares
 * disponibles se dibuja deshabilitado con la pista; si el libro ya está
 * publicado, la ficha ofrece «Ver publicación».
 */
const PLENO = VERDE
const POR_PAGINA = 12

export default function MisLibros() {
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aviso, setAviso] = useState(null) // éxito de la última operación
  const [formulario, setFormulario] = useState(null) // { libro? } abierto
  const [retiro, setRetiro] = useState(null) // libro a retirar
  const [publicando, setPublicando] = useState(null) // libro a publicar

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
                alPublicar={() => {
                  setAviso(null)
                  setPublicando(libro)
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

      {publicando && (
        <DialogoPublicar libro={publicando} alCerrar={() => setPublicando(null)} />
      )}
    </Marco>
  )
}

/** Una ficha del catálogo con los tres números. */
function FichaLibro({ libro, alEditar, alRetirar, alPublicar }) {
  const navigate = useNavigate()
  const sinDisponibles = libro.disponible <= 0
  const datos = lineaDeDatos(libro) // LET-123

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
            {libro.publicado ? (
              <Boton tamano="chico" onClick={() => navigate(`/publicaciones/${libro.publicacionId}`)}>
                Ver publicación
              </Boton>
            ) : (
              <>
                {sinDisponibles && <span className="libro__pista">Sin ejemplares disponibles</span>}
                <Boton
                  tamano="chico"
                  variante={sinDisponibles ? undefined : 'naranja'}
                  disabled={sinDisponibles}
                  title={sinDisponibles ? 'Sin ejemplares disponibles' : undefined}
                  onClick={alPublicar}
                >
                  Publicar
                </Boton>
              </>
            )}
          </span>
        </>
      }
    >
      {datos && <p className="libro__datos">{datos}</p>}
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

/** Los seis datos opcionales del libro, en el orden del formulario. */
const OPCIONALES = ['editorial', 'anio', 'edicion', 'isbn', 'estadoConservacion', 'descripcion']
const LARGO_DESCRIPCION = 500

/** Valor de un dato opcional para un input controlado: null -> ''. */
function textoDe(valor) {
  return valor === null || valor === undefined ? '' : String(valor)
}

/*
 * Alta y edición en el mismo formulario. Arriba los tres obligatorios; abajo,
 * plegada, «Más datos (opcional)» con los seis de LET-112. Al editar, la
 * sección se abre sola si el libro tiene alguno cargado, y también se abre si
 * el servidor marca un error en uno de ellos.
 *
 * En edición, si hay reservas, la cantidad no puede bajar de `reservada`: la
 * pista lo dice y el botón se deshabilita por debajo — el mismo límite que
 * exige el servidor.
 */
function DialogoLibro({ libro, alCerrar, alGuardar }) {
  const esAlta = !libro
  const minimo = esAlta ? 1 : Math.max(1, libro.reservada)
  const anioActual = new Date().getFullYear()

  const [titulo, setTitulo] = useState(libro?.titulo ?? '')
  const [autor, setAutor] = useState(libro?.autor ?? '')
  const [cantidad, setCantidad] = useState(String(libro?.total ?? 1))
  const [opcionales, setOpcionales] = useState(() =>
    Object.fromEntries(OPCIONALES.map((campo) => [campo, textoDe(libro?.[campo])])),
  )
  const [masAbierto, setMasAbierto] = useState(
    () => !esAlta && OPCIONALES.some((campo) => textoDe(libro[campo]) !== ''),
  )
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  const cambiar = (campo) => (e) => setOpcionales((o) => ({ ...o, [campo]: e.target.value }))

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
    // Los opcionales viajan como texto: el servidor recorta y deja en null los vacíos.
    const cuerpo = { titulo, autor, cantidad: cantidad === '' ? cantidad : numero, ...opcionales }
    try {
      const { libro: guardado } = esAlta
        ? await enviar('/libros', cuerpo)
        : await actualizar(`/libros/${libro.id}`, cuerpo)
      alGuardar(guardado, esAlta)
    } catch (error) {
      setEnviando(false)
      if (error instanceof ErrorApi && error.codigo === 'DATOS_INVALIDOS' && error.detalles.length) {
        const errores = mapearDetalles(error.detalles)
        setErroresCampo(errores)
        if (OPCIONALES.some((campo) => errores[campo])) setMasAbierto(true)
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

      <details
        className="libro__mas"
        open={masAbierto}
        onToggle={(e) => setMasAbierto(e.currentTarget.open)}
      >
        <summary className="libro__mas-titulo">Más datos (opcional)</summary>
        <Campo
          id="libro-editorial"
          etiqueta="Editorial"
          valor={opcionales.editorial}
          alCambiar={cambiar('editorial')}
          error={erroresCampo.editorial}
          pleno={PLENO}
          disabled={enviando}
          maxLength={120}
        />
        <div className="libro__mas-grilla">
          <Campo
            id="libro-anio"
            etiqueta="Año de publicación"
            tipo="number"
            inputMode="numeric"
            min={1450}
            max={anioActual}
            step={1}
            valor={opcionales.anio}
            alCambiar={cambiar('anio')}
            error={erroresCampo.anio}
            pleno={PLENO}
            disabled={enviando}
          />
          <Campo
            id="libro-edicion"
            etiqueta="Edición"
            placeholder="3.ª edición, bolsillo…"
            valor={opcionales.edicion}
            alCambiar={cambiar('edicion')}
            error={erroresCampo.edicion}
            pleno={PLENO}
            disabled={enviando}
            maxLength={60}
          />
          <Campo
            id="libro-isbn"
            etiqueta="ISBN"
            inputMode="numeric"
            placeholder="978-950-07-0313-4"
            valor={opcionales.isbn}
            alCambiar={cambiar('isbn')}
            error={erroresCampo.isbn}
            pleno={PLENO}
            disabled={enviando}
            maxLength={20}
          />
          <Campo
            id="libro-estado"
            etiqueta="Estado de conservación"
            elemento="select"
            valor={opcionales.estadoConservacion}
            alCambiar={cambiar('estadoConservacion')}
            error={erroresCampo.estadoConservacion}
            pleno={PLENO}
            disabled={enviando}
          >
            <option value="">Sin indicar</option>
            {ESTADOS_CONSERVACION.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Campo>
        </div>
        <Campo
          id="libro-descripcion"
          etiqueta="Descripción"
          elemento="textarea"
          placeholder="Estado de las tapas, anotaciones, lo que quieras contar del ejemplar."
          valor={opcionales.descripcion}
          alCambiar={cambiar('descripcion')}
          error={erroresCampo.descripcion}
          pista={`${opcionales.descripcion.length}/${LARGO_DESCRIPCION}`}
          pleno={PLENO}
          disabled={enviando}
          maxLength={LARGO_DESCRIPCION}
          rows={4}
        />
      </details>
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

const BYTES_MAX_FOTO = 2 * 1024 * 1024
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const LARGO_NOTA = 300

/*
 * Publicar un libro del catálogo (LET-134, RF-14, CU-16): nota y foto
 * opcionales. Crea la publicación y, si hay foto, la sube después; al
 * terminar lleva al detalle. Si la foto falla, la publicación igual queda
 * creada y el detalle lo avisa: la foto se puede agregar desde ahí.
 */
function DialogoPublicar({ libro, alCerrar }) {
  const navigate = useNavigate()
  const [nota, setNota] = useState('')
  const [foto, setFoto] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [errorFoto, setErrorFoto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => () => vistaPrevia && URL.revokeObjectURL(vistaPrevia), [vistaPrevia])

  function alElegirFoto(evento) {
    const archivo = evento.target.files?.[0]
    setErrorFoto(null)
    if (!archivo) return
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setErrorFoto('La foto tiene que ser una imagen JPEG, PNG o WebP.')
      evento.target.value = ''
      return
    }
    if (archivo.size > BYTES_MAX_FOTO) {
      setErrorFoto('La foto supera el máximo de 2 MB. Probá con una más liviana.')
      evento.target.value = ''
      return
    }
    setFoto(archivo)
    setVistaPrevia(URL.createObjectURL(archivo))
  }

  async function alEnviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    let publicacion
    try {
      ;({ publicacion } = await enviar('/publicaciones', { libroId: libro.id, nota }))
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
      return
    }
    let aviso = `Publicaste «${libro.titulo}». Ya aparece en Explorar.`
    if (foto) {
      try {
        await subirArchivo(`/publicaciones/${publicacion.id}/foto`, foto)
      } catch (e) {
        aviso = `Publicaste «${libro.titulo}», pero no pudimos subir la foto: ${mensajeDeError(e)} Podés agregarla desde acá.`
      }
    }
    navigate(`/publicaciones/${publicacion.id}`, { state: { aviso } })
  }

  return (
    <Dialogo
      abierto
      titulo="Publicar un libro"
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={alEnviar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            Descartar
          </Boton>
          <Boton tipo="submit" variante="naranja" cargando={enviando} textoCargando="Publicando…">
            Publicar
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">
        Vas a ofrecer un ejemplar de <b>{libro.titulo}</b> en Explorar.
      </p>
      <Campo
        id="publicar-nota"
        etiqueta="Nota (opcional)"
        elemento="textarea"
        placeholder="Dónde lo entregás, en qué horarios, lo que quieras aclarar."
        valor={nota}
        alCambiar={(e) => setNota(e.target.value)}
        pista={`${nota.length}/${LARGO_NOTA}`}
        pleno={PLENO}
        disabled={enviando}
        maxLength={LARGO_NOTA}
        rows={3}
      />
      <div className="libro__foto">
        <span className="campo__etiqueta">Foto (opcional)</span>
        {vistaPrevia && <img src={vistaPrevia} alt="" className="libro__foto-previa" />}
        <label className="libro__enlace libro__elegir-foto">
          {foto ? 'Elegir otra foto' : 'Elegir una foto'}
          <input
            type="file"
            accept={TIPOS_FOTO.join(',')}
            onChange={alElegirFoto}
            disabled={enviando}
            className="libro__archivo"
          />
        </label>
        <p className="campo__pista">JPEG, PNG o WebP, hasta 2 MB.</p>
        {errorFoto && (
          <p className="campo__error" role="alert">
            {errorFoto}
          </p>
        )}
      </div>
    </Dialogo>
  )
}
