import { Router } from 'express';
import rutasSalud from './rutas/salud.js';

/**
 * Router raiz de la API. Todo lo que cuelga de `/api` se monta aca.
 * Las rutas de autenticacion las agrega LET-18.
 */
const api = Router();

api.use(rutasSalud);

export default api;
