import { useState } from 'react'
import { Link } from 'react-router-dom'

import Aviso from '../componentes/Aviso.jsx'
import Boton from '../componentes/Boton.jsx'
import Campo from '../componentes/Campo.jsx'
import Dialogo from '../componentes/Dialogo.jsx'
import { Cargando, ErrorCarga, EsqueletoPapel } from '../componentes/Estados.jsx'
import { IconoCheck, IconoPendiente } from '../componentes/Iconos.jsx'
import Marco from '../componentes/Marco.jsx'
import Reputacion from '../componentes/Reputacion.jsx'
import { useSesion } from '../contexto/Sesion.jsx'
import { VERDE } from '../estilos/pleno.js'
import { useCarga } from '../ganchos/useCarga.js'
import { actualizar, eliminar, ErrorApi, obtener } from '../servicios/cliente.js'
import { mapearDetalles, mensajeDeError } from '../servicios/errores.js'
import './PantallaAuth.css' // los indicadores de contraseña del registro
import './Perfil.css'

/*
 * /perfil — perfil propio (LET-40, LET-51; DISENIO-MODULO-2 §3.5 y §5.3).
 * Pleno verde. Tres papeles apilados en una columna de 560 px:
 *
 *   1. Tus datos   nombre editable (PUT /api/perfil), correo en gris y fijo,
 *                  miembro desde, reputación.
 *   2. Contraseña  actual, nueva y confirmación, con los indicadores en vivo
 *                  del registro (PUT /api/perfil/contrasena).
 *   3. Dar de baja borde rojo; abre el diálogo (DELETE /api/perfil).
 *
 * Estados: esqueleto de los papeles mientras carga; error con «Reintentar».
 * No hay «vacío»: si hay sesión, hay perfil.
 *
 * Nota: PUT /api/perfil y PUT /api/perfil/contrasena los suma otra tarea del
 * backend (LET-65, LET-66). Mientras no estén, la API contesta 404 y la
 * pantalla muestra ese mensaje en el aviso del papel correspondiente.
 */
const PLENO = VERDE

const REQUISITOS = [
  { clave: 'longitud', texto: 'Al menos 8 caracteres', cumple: (c) => c.length >= 8 },
  { clave: 'letra', texto: 'Una letra', cumple: (c) => /[a-zA-Z]/.test(c) },
  { clave: 'numero', texto: 'Un número', cumple: (c) => /[0-9]/.test(c) },
]

export default function Perfil() {
  const carga = useCarga(() => obtener('/perfil').then((d) => d.perfil), [])
  const perfil = carga.datos

  return (
    <Marco pleno={PLENO} lema="Tu *cuenta*." tituloPagina="Tu cuenta">
      <div className="perfil__columna" aria-busy={carga.cargando || undefined}>
        {carga.cargando && !perfil && <Cargando texto="Cargando tu perfil…" />}
        {carga.error ? (
          <ErrorCarga
            mensaje={mensajeDeError(
              carga.error,
              'No pudimos cargar tu perfil. Revisá tu conexión e intentá de nuevo.',
            )}
            alReintentar={carga.recargar}
          />
        ) : !perfil ? (
          <>
            <EsqueletoPapel lineas={2} />
            <EsqueletoPapel lineas={2} />
          </>
        ) : (
          <>
            <TusDatos perfil={perfil} alCambiar={(p) => carga.cambiarDatos((d) => ({ ...d, ...p }))} />
            <CambioContrasena />
            <DarDeBaja />
          </>
        )}
      </div>
    </Marco>
  )
}

/* ---------- 1. Tus datos ---------- */

function TusDatos({ perfil, alCambiar }) {
  const { actualizarUsuario } = useSesion()
  const [nombre, setNombre] = useState(perfil.nombre)
  const [enviando, setEnviando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [errorNombre, setErrorNombre] = useState(null)

  async function alEnviar(evento) {
    evento.preventDefault()
    setGuardado(false)
    setErrorGeneral(null)
    setErrorNombre(null)
    if (!nombre.trim()) {
      setErrorNombre('El nombre es obligatorio.')
      return
    }
    setEnviando(true)
    try {
      const respuesta = await actualizar('/perfil', { nombre })
      // El contrato devuelve { perfil }; se acepta también { usuario }.
      const nuevo = respuesta?.perfil ?? respuesta?.usuario ?? { nombre: nombre.trim() }
      setNombre(nuevo.nombre)
      alCambiar({ nombre: nuevo.nombre })
      actualizarUsuario({ nombre: nuevo.nombre })
      setGuardado(true)
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'DATOS_INVALIDOS' && error.detalles.length) {
        setErrorNombre(mapearDetalles(error.detalles).nombre ?? error.mensaje)
      } else {
        setErrorGeneral(mensajeDeError(error))
      }
    } finally {
      setEnviando(false)
    }
  }

  const miembroDesde = formatearMes(perfil.creadoEn)

  return (
    <section className="papel" aria-labelledby="perfil-datos-titulo">
      <h2 id="perfil-datos-titulo" className="papel__titulo">
        Tus datos
      </h2>
      {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}
      <form onSubmit={alEnviar} noValidate>
        <Campo
          id="perfil-nombre"
          etiqueta="Nombre"
          valor={nombre}
          alCambiar={(e) => {
            setNombre(e.target.value)
            setGuardado(false)
          }}
          pista="Hasta 80 caracteres. Es el nombre que ve el resto."
          error={errorNombre}
          pleno={PLENO}
          autoComplete="name"
          maxLength={80}
          required
        />

        <div className="campo">
          <div className="campo__fila">
            <label className="campo__etiqueta" htmlFor="perfil-correo">
              Correo
            </label>
          </div>
          <input
            id="perfil-correo"
            className="perfil__solo-lectura"
            type="email"
            value={perfil.email}
            readOnly
            aria-describedby="perfil-correo-pista"
          />
          <p className="campo__pista" id="perfil-correo-pista">
            El correo no se puede cambiar. Nunca aparece en tu perfil público.
          </p>
        </div>

        <dl className="perfil__datos">
          <div>
            <dt>Miembro desde</dt>
            <dd>{miembroDesde}</dd>
          </div>
          <div>
            <dt>Reputación</dt>
            <dd>
              <Reputacion
                promedio={perfil.reputacion?.promedio}
                cantidad={perfil.reputacion?.cantidad}
              />
            </dd>
          </div>
          <div>
            <dt>Perfil público</dt>
            <dd>
              <Link to={`/usuarios/${perfil.id}`} className="perfil__enlace">
                Ver cómo te ven
              </Link>
            </dd>
          </div>
        </dl>

        <div className="perfil__pie">
          <span className="perfil__estado" aria-live="polite">
            {guardado && (
              <span className="perfil__guardado">
                <IconoCheck tam={12} />
                Cambios guardados
              </span>
            )}
          </span>
          <Boton
            tipo="submit"
            variante="naranja"
            tamano="grande"
            cargando={enviando}
            textoCargando="Guardando…"
            disabled={nombre.trim() === perfil.nombre}
          >
            Guardar
          </Boton>
        </div>
      </form>
    </section>
  )
}

/* ---------- 2. Contraseña ---------- */

function CambioContrasena() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cambiada, setCambiada] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [erroresCampo, setErroresCampo] = useState({})

  const cumpleTodo = REQUISITOS.every((r) => r.cumple(nueva))
  const coincide = confirmacion !== '' && confirmacion === nueva
  const puedeEnviar = actual !== '' && cumpleTodo && coincide

  function limpiarEstado() {
    setCambiada(false)
    setErrorGeneral(null)
  }

  async function alEnviar(evento) {
    evento.preventDefault()
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorGeneral(null)
    setErroresCampo({})
    setCambiada(false)
    try {
      await actualizar('/perfil/contrasena', { contrasenaActual: actual, contrasenaNueva: nueva })
      setActual('')
      setNueva('')
      setConfirmacion('')
      setCambiada(true)
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'CONTRASENA_INCORRECTA') {
        setErroresCampo({ contrasenaActual: 'La contraseña actual no es correcta.' })
      } else if (error instanceof ErrorApi && error.codigo === 'DATOS_INVALIDOS' && error.detalles.length) {
        setErroresCampo(mapearDetalles(error.detalles))
      } else {
        setErrorGeneral(mensajeDeError(error))
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="papel" aria-labelledby="perfil-contrasena-titulo">
      <h2 id="perfil-contrasena-titulo" className="papel__titulo">
        Contraseña
      </h2>
      {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}
      <form onSubmit={alEnviar} noValidate>
        <Campo
          id="perfil-contrasena-actual"
          etiqueta="Contraseña actual"
          tipo="password"
          valor={actual}
          alCambiar={(e) => {
            setActual(e.target.value)
            limpiarEstado()
            setErroresCampo((x) => ({ ...x, contrasenaActual: undefined }))
          }}
          error={erroresCampo.contrasenaActual}
          pleno={PLENO}
          autoComplete="current-password"
          required
        />
        <div className="perfil__campo-clave">
          <Campo
            id="perfil-contrasena-nueva"
            etiqueta="Contraseña nueva"
            valor={nueva}
            alCambiar={(e) => {
              setNueva(e.target.value)
              limpiarEstado()
            }}
            error={erroresCampo.contrasenaNueva}
            pleno={PLENO}
            conMostrar
            autoComplete="new-password"
            required
          />
          <ul className="pantalla-auth__requisitos perfil__requisitos" aria-label="Requisitos de la contraseña">
            {REQUISITOS.map((r) => {
              const cumplido = r.cumple(nueva)
              return (
                <li key={r.clave} className={cumplido ? 'es-cumplido' : ''}>
                  {cumplido ? <IconoCheck tam={13} /> : <IconoPendiente />}
                  {r.texto}
                  <span className="solo-lector">{cumplido ? ' (cumplido)' : ' (pendiente)'}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <Campo
          id="perfil-contrasena-confirmacion"
          etiqueta="Repetí la contraseña nueva"
          tipo="password"
          valor={confirmacion}
          alCambiar={(e) => {
            setConfirmacion(e.target.value)
            limpiarEstado()
          }}
          error={confirmacion !== '' && !coincide ? 'No coincide con la contraseña nueva.' : undefined}
          pleno={PLENO}
          autoComplete="new-password"
          required
        />

        {cambiada && (
          <Aviso tipo="exito" titulo="Contraseña cambiada.">
            Cerramos tus otras sesiones. Esta sigue abierta.
          </Aviso>
        )}

        <div className="perfil__pie">
          <p className="perfil__nota">Al cambiarla se cierran tus otras sesiones. Esta no.</p>
          <Boton
            tipo="submit"
            variante="naranja"
            tamano="grande"
            cargando={enviando}
            textoCargando="Cambiando…"
            disabled={!puedeEnviar}
          >
            Cambiar
          </Boton>
        </div>
      </form>
    </section>
  )
}

/* ---------- 3. Dar de baja ---------- */

function DarDeBaja() {
  const [abierto, setAbierto] = useState(false)

  return (
    <section className="papel perfil__baja" aria-labelledby="perfil-baja-titulo">
      <div>
        <h2 id="perfil-baja-titulo" className="papel__titulo perfil__baja-titulo">
          Dar de baja la cuenta
        </h2>
        <p className="perfil__nota">Se eliminan tus datos personales. No se puede deshacer.</p>
      </div>
      <Boton variante="peligro-contorno" tamano="grande" onClick={() => setAbierto(true)}>
        Dar de baja
      </Boton>
      {abierto && <DialogoBaja alCerrar={() => setAbierto(false)} />}
    </section>
  )
}

/*
 * Diálogo de baja (RF-09): enumera lo que va a pasar, pide la contraseña y
 * exige escribir BAJA para habilitar el botón. Al confirmar, el servidor ya
 * revocó todas las sesiones: se olvida el token SIN llamar a /auth/logout y
 * Login muestra «Tu cuenta fue eliminada».
 */
function DialogoBaja({ alCerrar }) {
  const { olvidarSesion } = useSesion()
  const [contrasena, setContrasena] = useState('')
  const [palabra, setPalabra] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [errorContrasena, setErrorContrasena] = useState(null)

  const habilitado = palabra.trim() === 'BAJA' && contrasena !== ''

  async function alEnviar(evento) {
    evento.preventDefault()
    if (!habilitado) return
    setEnviando(true)
    setError(null)
    setErrorContrasena(null)
    try {
      await eliminar('/perfil', { cuerpo: { contrasena } })
      // RutaProtegida ve el usuario en null y lleva a /login, donde el aviso
      // 'baja' muestra «Tu cuenta fue eliminada».
      olvidarSesion('baja')
    } catch (e) {
      setEnviando(false)
      if (e instanceof ErrorApi && e.codigo === 'CONTRASENA_INCORRECTA') {
        setErrorContrasena('La contraseña no es correcta.')
      } else if (e instanceof ErrorApi && e.codigo === 'DATOS_INVALIDOS' && e.detalles.length) {
        setErrorContrasena(mapearDetalles(e.detalles).contrasena ?? e.mensaje)
      } else {
        setError(mensajeDeError(e))
      }
    }
  }

  return (
    <Dialogo
      abierto
      peligro
      titulo="¿Dar de baja tu cuenta?"
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
            variante="peligro"
            disabled={!habilitado}
            cargando={enviando}
            textoCargando="Dando de baja…"
          >
            Dar de baja
          </Boton>
        </>
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="dialogo__texto">Esto es lo que va a pasar. No se puede deshacer:</p>
      <ul className="dialogo__lista">
        <li>
          Se eliminan tu <b>nombre, tu correo y tu contraseña</b>.
        </li>
        <li>
          Se <b>archivan tus libros</b>.
        </li>
        <li>
          Se <b>cierran tus sesiones</b>.
        </li>
      </ul>
      <Campo
        id="baja-contrasena"
        etiqueta="Confirmá con tu contraseña"
        tipo="password"
        valor={contrasena}
        alCambiar={(e) => {
          setContrasena(e.target.value)
          setErrorContrasena(null)
        }}
        error={errorContrasena}
        pleno={PLENO}
        autoComplete="current-password"
        disabled={enviando}
        required
      />
      <div className="perfil__palabra">
        <Campo
          id="baja-palabra"
          etiqueta="Escribí BAJA para habilitar el botón"
          valor={palabra}
          alCambiar={(e) => setPalabra(e.target.value)}
          placeholder="BAJA"
          pleno={PLENO}
          autoComplete="off"
          spellCheck={false}
          disabled={enviando}
        />
      </div>
    </Dialogo>
  )
}

/** '2026-09-01T…' -> 'septiembre de 2026' */
function formatearMes(iso) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
