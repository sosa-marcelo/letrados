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
import { actualizar, conConsulta, eliminar, enviar, obtener, subirArchivo } from '../servicios/cliente.js'
import { mensajeDeError } from '../servicios/errores.js'
import { textoEstadoConservacion, urlFoto } from '../servicios/libro.js'
import './Publicacion.css'

/*
 * /publicaciones/:id — detalle de una publicación (LET-133, RF-16, CU-19).
 * Pública, pleno naranja. Responde en cualquier estado: los enlaces del
 * historial no se rompen.
 *
 *   Franja   título y autor del libro · «Solicitar intercambio» si es ajena
 *            y está activa: sin sesión lleva a /login; con sesión abre el
 *            diálogo para ofrecer un libro propio (LET-149, RF-17, CU-20)
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
  const [dialogo, setDialogo] = useState(null) // 'nota' | 'retiro' | 'solicitar'
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
    if (!usuario) {
      navigate('/login')
      return
    }
    setAviso(null)
    setDialogo('solicitar')
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
          <Pastilla pleno={PLENO} onClick={solicitar}>
            Solicitar intercambio
          </Pastilla>
        ) : undefined
      }
    >
      {aviso === 'solicitud-enviada' ? (
        <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
          <b>Solicitud enviada.</b> Seguila en <Link to="/solicitudes">Solicitudes</Link>: ahí vas a
          ver si la aceptan.
        </Aviso>
      ) : (
        aviso && (
          <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
            <b>{aviso}</b>
          </Aviso>
        )
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

      {dialogo === 'solicitar' && publicacion && (
        <DialogoSolicitar
          publicacion={publicacion}
          alCerrar={() => setDialogo(null)}
          alEnviar={() => {
            setDialogo(null)
            setAviso('solicitud-enviada')
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

/*
 * Solicitar un intercambio (LET-149, RF-17, CU-20): se ofrece exactamente un
 * libro propio con al menos un ejemplar disponible. Sin ninguno, avisa y
 * manda a Mis libros. Los 409 del servidor (ya hay una pendiente, el libro se
 * quedó sin ejemplares, la publicación dejó de estar disponible) se muestran
 * acá y el diálogo no se cierra.
 */
function DialogoSolicitar({ publicacion, alCerrar, alEnviar }) {
  const carga = useCarga(() => obtener(conConsulta('/libros', { porPagina: 50 })), [])
  const [elegido, setElegido] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const disponibles = (carga.datos?.datos ?? []).filter((libro) => libro.disponible >= 1)

  async function confirmar(evento) {
    evento.preventDefault()
    if (!elegido) {
      setError('Elegí el libro que ofrecés a cambio.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await enviar('/solicitudes', { publicacionId: publicacion.id, libroOfrecidoId: elegido })
      alEnviar()
    } catch (e) {
      setEnviando(false)
      setError(mensajeDeError(e))
    }
  }

  const sinLibros = carga.datos && disponibles.length === 0

  return (
    <Dialogo
      abierto
      titulo="Solicitar intercambio"
      alCerrar={alCerrar}
      ocupado={enviando}
      alEnviar={confirmar}
      acciones={
        <>
          <Boton onClick={alCerrar} disabled={enviando}>
            {sinLibros ? 'Volver' : 'Descartar'}
          </Boton>
          {!sinLibros && (
            <Boton
              tipo="submit"
              variante="naranja"
              cargando={enviando}
              textoCargando="Enviando…"
              disabled={!carga.datos}
            >
              Enviar solicitud
            </Boton>
          )}
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">
        Pedís <b>{publicacion.libro.titulo}</b> a {publicacion.propietario.nombre}. Elegí qué libro
        de tu catálogo ofrecés a cambio.
      </p>
      {carga.error ? (
        <Aviso tipo="error">
          {mensajeDeError(carga.error, 'No pudimos cargar tu catálogo.')}{' '}
          <button type="button" className="publicacion__enlace" onClick={carga.recargar}>
            Reintentar
          </button>
        </Aviso>
      ) : !carga.datos ? (
        <p className="dialogo__texto">Cargando tu catálogo…</p>
      ) : sinLibros ? (
        <Aviso tipo="info">
          No tenés libros con ejemplares disponibles para ofrecer.{' '}
          <Link to="/mis-libros">Cargá uno en Mis libros</Link> y volvé.
        </Aviso>
      ) : (
        <fieldset className="solicitar__opciones" disabled={enviando}>
          <legend className="solo-lector">Libro que ofrecés</legend>
          {disponibles.map((libro) => (
            <label
              key={libro.id}
              className={`solicitar__opcion ${elegido === libro.id ? 'solicitar__opcion--elegida' : ''}`.trim()}
            >
              <input
                type="radio"
                name="libro-ofrecido"
                value={libro.id}
                checked={elegido === libro.id}
                onChange={() => setElegido(libro.id)}
              />
              <span>
                <b>{libro.titulo}</b>
                <span className="solicitar__autor">{libro.autor}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Dialogo>
  )
}
