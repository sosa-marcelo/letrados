import express, { Router } from 'express';

import rutasSalud from './rutas/salud.js';
import rutasAuth from './rutas/auth.js';
import { rutaNoEncontrada } from './middlewares/rutaNoEncontrada.js';
import { manejadorErrores } from './middlewares/manejadorErrores.js';

/**
 * Router raiz de la API. Todo lo que cuelga de `/api` se monta aca.
 *
 * Orden dentro del router:
 *   0. `express.json()` — el parseo vive ACA, no a nivel de app: si estuviera
 *      afuera, un cuerpo mal formado saldria por el manejador por defecto de
 *      Express (HTML y volcado de pila) sin pasar por el nuestro.
 *   1. las rutas (salud, auth).
 *   2. `rutaNoEncontrada` — terminador: un `/api/...` sin match sale 404 JSON,
 *      no se lo come el comodin de la SPA.
 *   3. `manejadorErrores` — formato unico de error. Vive dentro del router para
 *      que solo aplique a `/api` y no responda JSON cuando falla la SPA.
 */
const api = Router();

api.use(express.json());

api.use(rutasSalud);
api.use(rutasAuth);

api.use(rutaNoEncontrada);
api.use(manejadorErrores);

export default api;
