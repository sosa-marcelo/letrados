import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import api from './api/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carpeta que compila Vite. En desarrollo todavia no existe.
const DIR_ESTATICOS = resolve(__dirname, '../../frontend/dist');

/**
 * Arma la aplicacion Express y la devuelve SIN ponerla a escuchar.
 * `servidor.js` es el unico que abre un puerto; asi las pruebas pueden importar
 * la app con supertest sin ocupar sockets.
 *
 * @returns {import('express').Express}
 */
export function crearApp() {
  const app = express();

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // ORDEN DE MONTAJE — NO CAMBIAR.
  //   1. /api            -> la API siempre primero.
  //   2. estaticos       -> archivos que compila Vite.
  //   3. comodin -> index.html (SPA).
  // Si los estaticos o el comodin van antes que /api, en produccion el comodin
  // se traga las rutas de /api y la API deja de responder.
  // ---------------------------------------------------------------------------

  // 1. API
  app.use('/api', api);

  // 2 y 3. Estaticos + comodin de la SPA. Solo si existe el build del frontend,
  // para no romper el arranque en desarrollo.
  if (existsSync(DIR_ESTATICOS)) {
    app.use(express.static(DIR_ESTATICOS));
    app.get('/{*ruta}', (_req, res) => {
      res.sendFile(resolve(DIR_ESTATICOS, 'index.html'));
    });
  }

  return app;
}

export default crearApp;
