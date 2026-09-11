import { obtenerConfig } from './config.js';
import { registrador } from './registrador.js';

/** Unica salida de correo del backend. Elige la implementacion segun CORREO_PROVEEDOR. */
export async function enviarCorreo({ para, asunto, texto }) {
  const { correoProveedor } = obtenerConfig();

  if (correoProveedor === 'consola') {
    return enviarPorConsola({ para, asunto, texto });
  }
  return enviarConProveedorReal({ para, asunto, texto });
}

/** Desarrollo y pruebas: no sale nada a la red, el mensaje se escribe. */
async function enviarPorConsola({ para, asunto, texto }) {
  registrador.info(`[correo] para: ${para} | asunto: ${asunto}\n${texto}`);
}

/** Produccion. Se completa cuando exista la cuenta del proveedor. */
async function enviarConProveedorReal() {
  throw new Error('El proveedor de correo real todavia no esta configurado');
}
