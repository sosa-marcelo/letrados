import { sesionInvalida, cuentaBloqueada } from '../../domain/errores.js';
import { verificar } from '../../infra/jwt.js';
import { buscarSesionVigente } from '../../data/sesiones.js';
import { buscarUsuarioPorId } from '../../data/usuarios.js';

/**
 * Middleware de sesion (LET-48). Asincrono: ademas de la firma, consulta la base.
 *
 * ```
 * 1. Leer el Bearer.                 falta o mal esquema  -> 401 SESION_INVALIDA
 * 2. verificar(token).               firma mala o vencido -> 401 SESION_INVALIDA
 * 3. buscarSesionVigente(jti).       revocada o vencida   -> 401 SESION_INVALIDA
 * 4. buscarUsuarioPorId(sub).        no existe            -> 401 SESION_INVALIDA
 * 5. usuario.estado !== 'activa'                          -> 403 CUENTA_BLOQUEADA
 * 6. req.usuario = { id, rol, estado, jti }
 * ```
 *
 * Los casos de 401 salen todos iguales, sin decir cual fue.
 *
 * **El rol sale de la fila de `usuarios`, no del token**: quien pierde el rol
 * de administrador deja de ejercerlo al instante, no cuando vence su token.
 *
 * @type {import('express').RequestHandler}
 */
export async function autenticar(req, _res, next) {
  const cabecera = req.get('authorization') ?? '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(sesionInvalida());
  }

  let carga;
  try {
    carga = verificar(token);
  } catch {
    return next(sesionInvalida());
  }
  if (!carga.jti) return next(sesionInvalida());

  try {
    const sesion = await buscarSesionVigente(carga.jti);
    if (!sesion || String(sesion.usuario_id) !== carga.id) {
      return next(sesionInvalida());
    }

    const usuario = await buscarUsuarioPorId(carga.id);
    if (!usuario) return next(sesionInvalida());
    if (usuario.estado !== 'activa') return next(cuentaBloqueada());

    req.usuario = {
      id: String(usuario.id),
      rol: usuario.rol,
      estado: usuario.estado,
      jti: carga.jti,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export default autenticar;
