import { crearApp } from './app.js';
import { obtenerConfig } from './infra/config.js';

/**
 * Punto de entrada del proceso. Valida la configuracion, arma la app y la
 * levanta en un puerto. Toda la logica de la app vive en `app.js` para poder
 * probarla sin abrir sockets.
 */

// Falla de entrada y con un mensaje claro si falta una variable obligatoria.
const config = obtenerConfig();

const app = crearApp();

app.listen(config.puerto, () => {
  console.log(`Letrados API escuchando en http://localhost:${config.puerto}`);
});
