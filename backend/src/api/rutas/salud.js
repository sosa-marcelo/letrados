import { Router } from 'express';

/**
 * Ruta de chequeo de salud. La usa el hosting y las pruebas de humo para saber
 * si el proceso esta vivo. No toca la base ni el dominio a proposito: responde
 * aunque la base este caida.
 */
const rutasSalud = Router();

rutasSalud.get('/salud', (_req, res) => {
  res.json({ estado: 'ok' });
});

export default rutasSalud;
