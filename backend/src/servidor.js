import { crearApp } from './app.js';

/**
 * Punto de entrada del proceso. Levanta la app en un puerto.
 * Toda la logica de la app vive en `app.js` para poder probarla sin abrir
 * sockets.
 */
const PUERTO = Number(process.env.PORT) || 3000;

const app = crearApp();

app.listen(PUERTO, () => {
  console.log(`Letrados API escuchando en http://localhost:${PUERTO}`);
});
