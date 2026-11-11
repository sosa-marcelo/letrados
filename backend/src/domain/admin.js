import { noEncontrado, estadoInvalido } from './errores.js';
import { enTransaccion } from '../infra/transaccion.js';
import {
  listarCuentas as listarCuentasDatos,
  bloquearFilaUsuario,
  actualizarEstadoCuenta,
} from '../data/usuarios.js';
import { revocarSesionesDeUsuario } from '../data/sesiones.js';
import { listarFlagueadas } from '../data/solicitudes.js';
import { reportesDeSolicitudes } from '../data/reportes.js';
import { flaguearVencidas } from './solicitudes.js';
import { vistaReporte } from './reportes.js';

/**
 * Administracion de cuentas (modulo 2, RF-07). Todas las funciones asumen que
 * la API ya verifico el rol con `exigirRol('administrador')`.
 */

const POR_PAGINA_MAX = 50;
const POR_PAGINA_DEFECTO = 20;
const ESTADOS = ['activa', 'bloqueada', 'eliminada'];

/**
 * @typedef {object} CuentaAdmin
 * @property {string} id
 * @property {string} nombre
 * @property {string} email - aca si sale: sin el correo no se identifica una cuenta para bloquearla.
 * @property {string} rol
 * @property {string} estado
 * @property {string} creadoEn
 * @property {number} sesionesActivas
 */

/** @returns {CuentaAdmin} */
function vistaCuenta(fila) {
  return {
    id: String(fila.id),
    nombre: fila.nombre,
    email: fila.email,
    rol: fila.rol,
    estado: fila.estado,
    creadoEn: new Date(fila.creado_en).toISOString(),
    sesionesActivas: Number(fila.sesiones_activas ?? 0),
  };
}

/**
 * Listado de cuentas con busqueda por nombre o correo, filtro por estado y
 * paginacion. Un estado desconocido se ignora; la paginacion fuera de rango se
 * recorta.
 *
 * @param {{ q?: string, estado?: string, pagina?: number | string, porPagina?: number | string }} filtro
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<{ datos: CuentaAdmin[], paginacion: { pagina: number, porPagina: number, total: number } }>}
 */
export async function listarCuentas({ q, estado, pagina, porPagina } = {}, { ejecutar } = {}) {
  const pag = recortar(pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tam = recortar(porPagina, 1, POR_PAGINA_MAX, POR_PAGINA_DEFECTO);
  const busqueda = typeof q === 'string' ? q.trim() : '';

  const { filas, total } = await listarCuentasDatos(
    {
      q: busqueda || undefined,
      estado: ESTADOS.includes(estado) ? estado : undefined,
      limite: tam,
      desplazamiento: (pag - 1) * tam,
    },
    ejecutar,
  );

  return { datos: filas.map(vistaCuenta), paginacion: { pagina: pag, porPagina: tam, total } };
}

/**
 * Bloquea una cuenta (RF-07): en una transaccion, `estado = 'bloqueada'` y se
 * revocan todas sus sesiones. El bloqueo no toca los intercambios en curso.
 *
 * Las reglas de negocio (no bloquearse a si mismo, no bloquear una cuenta
 * eliminada) estan en `validarCambioDeBloqueo`.
 *
 * @param {string} adminId - quien bloquea.
 * @param {string} cuentaId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<CuentaAdmin>}
 */
export async function bloquearCuenta(adminId, cuentaId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const cuenta = await bloquearFilaUsuario(cuentaId, tx);
      if (!cuenta) throw noEncontrado('No encontramos esa cuenta');
      validarCambioDeBloqueo(adminId, cuenta);

      const fila = await actualizarEstadoCuenta(cuentaId, 'bloqueada', tx);
      await revocarSesionesDeUsuario(cuentaId, {}, tx);
      return vistaCuenta({ ...fila, sesiones_activas: 0 });
    },
    { ejecutar },
  );
}

/**
 * Desbloquea una cuenta: vuelve a `activa`. No resucita sesiones: la persona
 * vuelve a entrar con su contrasena.
 *
 * @param {string} adminId
 * @param {string} cuentaId
 * @param {{ ejecutar?: import('../data/usuarios.js').Ejecutor }} [opciones]
 * @returns {Promise<CuentaAdmin>}
 */
export async function desbloquearCuenta(adminId, cuentaId, { ejecutar } = {}) {
  return enTransaccion(
    async (tx) => {
      const cuenta = await bloquearFilaUsuario(cuentaId, tx);
      if (!cuenta) throw noEncontrado('No encontramos esa cuenta');
      validarCambioDeBloqueo(adminId, cuenta);

      const fila = await actualizarEstadoCuenta(cuentaId, 'activa', tx);
      return vistaCuenta({ ...fila, sesiones_activas: 0 });
    },
    { ejecutar },
  );
}

/**
 * Reglas que deciden si una cuenta se puede bloquear o desbloquear. Las dos
 * responden 409 ESTADO_INVALIDO (DISENIO-MODULO-2 §4.2):
 *
 * - Un administrador no puede bloquearse ni desbloquearse a si mismo: es el
 *   caso que deja al sistema sin nadie que lo administre.
 * - Una cuenta eliminada no se puede bloquear ni desbloquear: despues de una
 *   baja ya no hay acceso que habilitar ni impedir.
 *
 * Se llama dentro de la transaccion y antes de escribir: si lanza, no se
 * modifica nada. Los ids se comparan como texto porque `cuenta.id` llega como
 * numero o como texto segun el driver.
 *
 * @param {string} adminId
 * @param {import('../data/usuarios.js').FilaUsuario} cuenta
 * @returns {void}
 */
export function validarCambioDeBloqueo(adminId, cuenta) {
  if (String(cuenta.id) === String(adminId)) {
    throw estadoInvalido('No podes bloquear ni desbloquear tu propia cuenta');
  }
  if (cuenta.estado === 'eliminada') {
    throw estadoInvalido('Una cuenta eliminada no se puede bloquear ni desbloquear');
  }
}

/** Entero dentro de [min, max]; si no es un numero, el valor por defecto. */
function recortar(valor, min, max, defecto) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return defecto;
  return Math.min(Math.max(n, min), max);
}

/**
 * Intercambios flagueados para el panel de administracion (RF-23, RF-24,
 * CU-27, LET-157): los que alguna vez vencieron sin las dos confirmaciones,
 * con las dos partes, los dos libros, el estado actual y sus reportes. Por
 * defecto solo los que siguen flagueados; `estado: 'todos'` trae tambien los
 * que despues se completaron o cancelaron. El administrador solo consulta.
 *
 * Barre los vencidos antes de listar: lo que vencio recien ya aparece.
 *
 * @param {{ estado?: string, pagina?: number | string, porPagina?: number | string }} filtro
 * @param {{ ejecutar?: Function }} [opciones]
 * @returns {Promise<{ datos: object[], paginacion: { pagina: number, porPagina: number, total: number } }>}
 */
export async function listarFlagueados({ estado, pagina, porPagina } = {}, { ejecutar } = {}) {
  await flaguearVencidas({ ejecutar });
  const pag = recortar(pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tam = recortar(porPagina, 1, POR_PAGINA_MAX, POR_PAGINA_DEFECTO);

  const { filas, total } = await listarFlagueadas(
    { soloFlagueadas: estado !== 'todos', limite: tam, desplazamiento: (pag - 1) * tam },
    ejecutar,
  );
  const reportes = await reportesDeSolicitudes(
    filas.map((f) => f.id),
    ejecutar,
  );
  const reportesDe = new Map();
  for (const r of reportes) {
    const clave = String(r.solicitud_id);
    reportesDe.set(clave, [...(reportesDe.get(clave) ?? []), vistaReporte(r)]);
  }

  const fecha = (valor) => (valor ? new Date(valor).toISOString() : null);
  return {
    datos: filas.map((f) => ({
      id: String(f.id),
      estado: f.estado,
      flagueadaEn: fecha(f.flagueada_en),
      motivo: f.motivo_flagueo,
      venceEn: fecha(f.vence_en),
      propietario: { id: String(f.propietario_id), nombre: f.propietario_nombre },
      solicitante: { id: String(f.solicitante_id), nombre: f.solicitante_nombre },
      libroSolicitado: { titulo: f.solicitado_titulo, autor: f.solicitado_autor },
      libroOfrecido: { titulo: f.ofrecido_titulo, autor: f.ofrecido_autor },
      reportes: reportesDe.get(String(f.id)) ?? [],
    })),
    paginacion: { pagina: pag, porPagina: tam, total },
  };
}
