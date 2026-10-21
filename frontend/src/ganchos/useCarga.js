import { useCallback, useEffect, useState } from 'react'

/*
 * Los cuatro estados de toda pantalla de datos (DISENIO-GENERAL §8.5):
 * cargando, vacío, error y con datos. El gancho resuelve tres —cargando,
 * error, datos— y la pantalla decide qué es «vacío» mirando los datos (una
 * lista sin filas, un perfil sin publicaciones…), porque eso depende de cada
 * una.
 *
 *   const carga = useCarga(() => obtener('/libros'), [q, pagina])
 *
 *   if (carga.error)           -> <ErrorCarga … alReintentar={carga.recargar} />
 *   else if (!carga.datos)     -> esqueleto (primera carga)
 *   else if (vacío)            -> <Vacio … />
 *   else                       -> los datos
 *
 * Al volver a cargar (cambia una dependencia o se llama a `recargar`) los
 * datos anteriores se conservan mientras llega la respuesta: el esqueleto es
 * sólo para la primera carga, así una búsqueda no hace saltar la página.
 * `cargando` sigue siendo true en ese lapso, para poner aria-busy.
 *
 * La respuesta de una carga vieja que llega tarde se descarta (la búsqueda
 * «ra» no puede pisar a «ray»).
 *
 * @template T
 * @param {() => Promise<T>} cargar
 * @param {unknown[]} dependencias
 * @returns {{
 *   datos: T | null, error: unknown, cargando: boolean,
 *   recargar: () => void, cambiarDatos: (f: T | ((actual: T) => T)) => void,
 * }}
 */
export function useCarga(cargar, dependencias = []) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null })
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let cancelado = false
    setEstado((actual) => ({ ...actual, cargando: true, error: null }))

    cargar()
      .then((datos) => {
        if (!cancelado) setEstado({ cargando: false, datos, error: null })
      })
      .catch((error) => {
        if (!cancelado) setEstado({ cargando: false, datos: null, error })
      })

    return () => {
      cancelado = true
    }
    // `cargar` cambia en cada render; lo que manda son las dependencias.
  }, [...dependencias, vuelta])

  const recargar = useCallback(() => setVuelta((v) => v + 1), [])

  const cambiarDatos = useCallback((f) => {
    setEstado((actual) => ({
      ...actual,
      datos: typeof f === 'function' ? f(actual.datos) : f,
    }))
  }, [])

  return { ...estado, recargar, cambiarDatos }
}
