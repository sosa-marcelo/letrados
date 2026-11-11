import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import Aviso from '../componentes/Aviso.jsx'
import Boton from '../componentes/Boton.jsx'
import Campo from '../componentes/Campo.jsx'
import Chip from '../componentes/Chip.jsx'
import Dialogo from '../componentes/Dialogo.jsx'
import { ErrorCarga, EsqueletoPapel } from '../componentes/Estados.jsx'
import Marco from '../componentes/Marco.jsx'
import Pastilla from '../componentes/Pastilla.jsx'
import Reputacion from '../componentes/Reputacion.jsx'
import Vacio from '../componentes/Vacio.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { NARANJA } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { actualizar, eliminar, obtener, subirArchivo } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import { textoEstadoConservacion, urlFoto } from '../servicios/libro.js'
import './Publicacion.css'

/*
 * /publicaciones/:id — detalle de una publicación (LET-133, RF-16, CU-19).
 * Pública, pleno naranja. Responde en cualquier estado: los enlaces del
 * historial no se rompen.
 *
 *   Franja   título y autor del libro · «Solicitar intercambio» si es ajena
 *            y está activa (sin sesión lleva a /login; el diálogo lo conecta
 *            la épica de solicitudes, LET-149)
 *   Lienzo   foto grande · estado y disponibilidad · nota · datos del libro ·
 *            el dueño con su reputación
 *
 * Si es tuya y está activa (RF-14, CU-17): cambiar o quitar la foto (con vista
 * previa mientras sube y aviso si pasa de 2 MB), editar la nota y retirarla.
 */
const PLENO = NARANJA
const BYTES_MAX_FOTO = 2 * 1024 * 1024
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const LARGO_NOTA = 300

export default function Publicacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useSesion()
  const { state } = useLocation()
  const carga = useCarga(() => obtener(`/publicaciones/${id}`), [id, usuario?.id])

  // Al llegar desde «Publicar» (LET-134) trae el aviso de lo que pasó.
  const [aviso, setAviso] = useState(state?.aviso ?? null)
  const [dialogo, setDialogo] = useState(null) // 'nota' | 'retiro'
  const [versionFoto, setVersionFoto] = useState(0)
  const [vistaPrevia, setVistaPrevia] = useState(null) // object URL mientras sube
  const [subiendo, setSubiendo] = useState(false)
  const [errorFoto, setErrorFoto] = useState(null)

  useEffect(() => () => vistaPrevia && URL.revokeObjectURL(vistaPrevia), [vistaPrevia])

  const publicacion = carga.datos?.publicacion
  const editable = publicacion?.esMia && publicacion.estado === 'activa'

  function reemplazar(nueva) {
    carga.cambiarDatos(() => ({ publicacion: nueva }))
  }

  async function alElegirFoto(evento) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setAviso(null)
    setErrorFoto(null)
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setErrorFoto('La foto tiene que ser una imagen JPEG, PNG o WebP.')
      return
    }
    if (archivo.size > BYTES_MAX_FOTO) {
      setErrorFoto('La foto supera el máximo de 2 MB. Probá con una más liviana.')
      return
    }
    setVistaPrevia(URL.createObjectURL(archivo))
    setSubiendo(true)
    try {
      const { publicacion: nueva } = await subirArchivo(`/publicaciones/${id}/foto`, archivo)
      reemplazar(nueva)
      setVersionFoto(Date.now())
      setAviso('Guardamos la foto nueva.')
    } catch (error) {
      setErrorFoto(mensajeDeError(error))
    } finally {
      setSubiendo(false)
      setVistaPrevia(null)
    }
  }

  async function quitarFoto() {
    setAviso(null)
    setErrorFoto(null)
    setSubiendo(true)
    try {
      const { publicacion: nueva } = await eliminar(`/publicaciones/${id}/foto`)
      reemplazar(nueva)
      setAviso('Quitamos la foto.')
    } catch (error) {
      setErrorFoto(mensajeDeError(error))
    } finally {
      setSubiendo(false)
    }
  }

  function solicitar() {
    if (!usuario) navigate('/login')
  }

  const puedeSolicitar = publicacion && !publicacion.esMia && publicacion.estado === 'activa'

  return (
    <Marco
      pleno={PLENO}
      titulo={publicacion?.libro.titulo ?? 'Publicación'}
      sub={publicacion?.libro.autor}
      tituloPagina={publicacion?.libro.titulo ?? 'Publicación'}
      accion={
        puedeSolicitar ? (
          <Pastilla
            pleno={PLENO}
            onClick={solicitar}
            disabled={Boolean(usuario)}
            title={usuario ? 'Las solicitudes se habilitan con el módulo de intercambios' : undefined}
          >
            Solicitar intercambio
          </Pastilla>
        ) : undefined
      }
    >
      {aviso && (
        <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
          <b>{aviso}</b>
        </Aviso>
      )}

      {carga.error ? (
        carga.error.estado === 404 ? (
          <Vacio
            titulo="No encontramos esa publicación"
            texto="Puede que el enlace esté mal escrito."
            accion={<Boton onClick={() => navigate('/')}>Ir a Explorar</Boton>}
          />
        ) : (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar la publicación. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        )
      ) : !publicacion ? (
        <EsqueletoPapel lineas={6} />
      ) : (
        <div className="publicacion">
          <div className="publicacion__columna-foto">
            <div className="publicacion__foto" aria-busy={subiendo || undefined}>
              {vistaPrevia ? (
                <img src={vistaPrevia} alt="" />
              ) : publicacion.tieneFoto ? (
                <img src={urlFoto(publicacion.id, versionFoto)} alt={`Foto de ${publicacion.libro.titulo}`} />
              ) : (
                <span className="publicacion__inicial" aria-hidden="true">
                  {publicacion.libro.titulo.trim().charAt(0)}
                </span>
              )}
            </div>

            {editable && (
              <div className="publicacion__acciones-foto">
                <label className={`publicacion__enlace ${subiendo ? 'publicacion__enlace--ocupado' : ''}`.trim()}>
                  {subiendo ? 'Subiendo…' : publicacion.tieneFoto ? 'Cambiar foto' : 'Agregar una foto'}
                  <input
                    type="file"
                    accept={TIPOS_FOTO.join(',')}
                    onChange={alElegirFoto}
                    disabled={subiendo}
                    className="publicacion__archivo"
                  />
                </label>
                {publicacion.tieneFoto && !subiendo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button type="button" className="publicacion__enlace" onClick={quitarFoto}>
                      Quitar foto
                    </button>
                  </>
                )}
                <span className="publicacion__pista">JPEG, PNG o WebP, hasta 2 MB.</span>
              </div>
            )}
            {errorFoto && (
              <p className="publicacion__error" role="alert">
                {errorFoto}
              </p>
            )}
          </div>

          <section className="publicacion__papel" aria-label="Datos de la publicación">
            <EstadoPublicacion publicacion={publicacion} />

            {publicacion.nota && <p className="publicacion__nota">«{publicacion.nota}»</p>}

            <DatosDelLibro libro={publicacion.libro} />

            <div className="publicacion__duenio">
              <span className="publicacion__etiqueta">Lo ofrece</span>
              <Link to={`/usuarios/${publicacion.propietario.id}`} className="publicacion__enlace">
                {publicacion.propietario.nombre}
              </Link>
              <Reputacion {...publicacion.propietario.reputacion} />
            </div>

            {editable && (
              <div className="publicacion__acciones">
                <Boton onClick={() => setDialogo('nota')}>
                  {publicacion.nota ? 'Editar la nota' : 'Agregar una nota'}
                </Boton>
                <Boton variante="peligro" onClick={() => setDialogo('retiro')}>
                  Retirar publicación
                </Boton>
              </div>
            )}
          </section>
        </div>
      )}

      {dialogo === 'nota' && publicacion && (
        <DialogoNota
          publicacion={publicacion}
          alCerrar={() => setDialogo(null)}
          alGuardar={(nueva) => {
            reemplazar(nueva)
            setDialogo(null)
            setAviso('Guardamos la nota.')
          }}
        />
      )}

      {dialogo === 'retiro' && publicacion && (
        <DialogoRetiro
          publicacion={publicacion}
          alCerrar={() => setDialogo(null)}
          alRetirar={() => {
            reemplazar({ ...publicacion, estado: 'retirada' })
            setDialogo(null)
            setAviso(`Retiraste la publicación. «${publicacion.libro.titulo}» sigue en tu catálogo.`)
          }}
        />
      )}
    </Marco>
  )
}

/** Estado de la publicación y cuántos ejemplares hay. */
function EstadoPublicacion({ publicacion }) {
  const { estado, libro, esMia } = publicacion
  const disponibles = `${libro.disponible} ${libro.disponible === 1 ? 'ejemplar disponible' : 'ejemplares disponibles'}`
  const textos = {
    activa: esMia ? 'Tu publicación está en Explorar.' : disponibles,
    reservada: 'Tiene una solicitud aceptada: el intercambio está en curso.',
    cerrada: 'El intercambio se completó.',
    retirada: 'La publicación se retiró y ya no se ofrece.',
  }
  return (
    <div className="publicacion__estado">
      <Chip estado={estado}>{estado === 'activa' ? 'Disponible' : undefined}</Chip>
      <span>{textos[estado]}</span>
    </div>
  )
}

/** Los datos del libro que se cargaron; los vacíos no se muestran. */
function DatosDelLibro({ libro }) {
  const filas = [
    ['Editorial', libro.editorial],
    ['Año', libro.anio],
    ['Edición', libro.edicion],
    ['ISBN', libro.isbn],
    ['Estado de conservación', textoEstadoConservacion(libro.estadoConservacion)],
  ].filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')

  if (filas.length === 0 && !libro.descripcion) return null

  return (
    <div className="publicacion__libro">
      {filas.length > 0 && (
        <dl className="publicacion__datos">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="publicacion__dato">
              <dt>{etiqueta}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {libro.descripcion && <p className="publicacion__descripcion">{libro.descripcion}</p>}
    </div>
  )
}

/** Editar la nota (RF-14). Vacía la borra. */
function DialogoNota({ publicacion, alCerrar, alGuardar }) {
  const [nota, setNota] = useState(publicacion.nota ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function alEnviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const { publicacion: nueva } = await actualizar(`/publicaciones/${publicacion.id}`, { nota })
      alGuardar(nueva)
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
    }
  }

  return (
    <Dialogo
      abierto
      titulo={publicacion.nota ? 'Editar la nota' : 'Agregar una nota'}
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={alEnviar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            Descartar
          </Boton>
          <Boton tipo="submit" variante="naranja" cargando={enviando} textoCargando="Guardando…">
            Guardar
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo
        id="publicacion-nota"
        etiqueta="Nota"
        elemento="textarea"
        placeholder="Dónde lo entregás, en qué horarios, lo que quieras aclarar."
        valor={nota}
        alCambiar={(e) => setNota(e.target.value)}
        pista={`${nota.length}/${LARGO_NOTA}`}
        pleno={PLENO}
        disabled={enviando}
        maxLength={LARGO_NOTA}
        rows={4}
      />
    </Dialogo>
  )
}

/** Retirar la publicación (RF-14). Si el servidor contesta 409, lo muestra. */
function DialogoRetiro({ publicacion, alCerrar, alRetirar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function confirmar() {
    setEnviando(true)
    setError(null)
    try {
      await eliminar(`/publicaciones/${publicacion.id}`)
      alRetirar()
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
    }
  }

  return (
    <Dialogo
      abierto
      titulo="¿Retirar la publicación?"
      alCerrar={alCerrar}
      ocupado={enviando}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando} data-autofoco>
            No, volver
          </Boton>
          <Boton variante="peligro" onClick={confirmar} cargando={enviando} textoCargando="Retirando…">
            Sí, retirar
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">
        <b>{publicacion.libro.titulo}</b> deja de verse en Explorar. El libro sigue en tu catálogo y
        lo podés volver a publicar cuando quieras.
      </p>
    </Dialogo>
  )
}
