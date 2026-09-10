import { Link } from 'react-router-dom'

import './Relleno.css'

/*
 * Placeholder de una pantalla que todavía no existe. Dice qué pantalla va acá
 * y qué épica la construye, y deja links para navegar el resto del andamio.
 * Lo reemplaza cada épica cuando arma su pantalla real.
 */
export default function Relleno({ pantalla, epica, rutas = [] }) {
  return (
    <main className="relleno">
      <div className="relleno__papel">
        <p className="relleno__marca">Letrados</p>
        <p className="relleno__eti">Andamio · pantalla pendiente</p>
        <h1 className="relleno__titulo">{pantalla}</h1>
        <p className="relleno__epica">
          La construye la épica <strong>{epica}</strong>.
        </p>

        {rutas.length > 0 && (
          <nav className="relleno__nav" aria-label="Rutas del andamio">
            {rutas.map((r) => (
              <Link key={r.a} to={r.a} className="relleno__link">
                {r.texto}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </main>
  )
}
