import { verificar } from '../../infra/jwt.js';
import { buscarSesionVigente } from '../../data/sesiones.js';
import { buscarUsuarioPorId } from '../../data/usuarios.js';

/**
 * Sesion opcional (LET-38, RF-15). Para rutas publicas cuya respuesta cambia si
 * hay sesion. Misma logica que `autenticar`, pero **cualquier problema deja
 * `req.usuario` en `undefined` y sigue sin error**: si devolviera 401, una ruta
 * publica dejaria de serlo para quien tiene un token viejo en el navegador.
 *
 * Un error de la base, en cambio, si sube: no es un problema de sesion.
 *
 * @type {import('express').RequestHandler}
 */
export async function sesionOpcional(req, _res, next) {
  const [esquema, token] = (req.get('authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next();

  let carga;
  try {
    carga = verificar(token);
  } catch {
    return next();
  }
  if (!carga.jti) return next();

  try {
    const sesion = await buscarSesionVigente(carga.jti);
    if (!sesion || String(sesion.usuario_id) !== carga.id) return next();

    const usuario = await buscarUsuarioPorId(carga.id);
    if (!usuario || usuario.estado !== 'activa') return next();

    req.usuario = { id: String(usuario.id), rol: usuario.rol, estado: usuario.estado, jti: carga.jti };
    return next();
  } catch (error) {
    return next(error);
  }
}

export default sesionOpcional;
