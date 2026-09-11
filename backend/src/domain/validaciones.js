// Validaciones de registro (RF-01 · LET-15).
// Funciones puras: reciben texto, devuelven { valida, mensaje }.
// No tocan base de datos ni HTTP (reglas de arquitectura del README).

/**
 * Valida el nombre.
 * Regla: obligatorio, entre 2 y 80 caracteres.
 * @param {string} nombre
 * @returns {{ valida: boolean, mensaje: string | null }}
 */
export function validarNombre(nombre) {
  const texto = (nombre ?? '').trim();

  if (texto.length < 2 || texto.length > 80) {
    return { valida: false, mensaje: 'El nombre debe tener entre 2 y 80 caracteres' };
  }

  return { valida: true, mensaje: null };
}

/**
 * Valida el correo electrónico.
 * Regla: obligatorio, formato válido, máximo 254 caracteres.
 * @param {string} email
 * @returns {{ valida: boolean, mensaje: string | null }}
 */
export function validarEmail(email) {
  const texto = (email ?? '').trim();

  if (texto.length === 0 || texto.length > 254) {
    return { valida: false, mensaje: 'Ingresá un correo válido' };
  }

  // Formato simple: algo@algo.algo (la validación definitiva es el correo real, si existiera)
  const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto);

  if (!formatoValido) {
    return { valida: false, mensaje: 'Ingresá un correo válido' };
  }

  return { valida: true, mensaje: null };
}

/**
 * Valida la contraseña.
 * Regla: mínimo 8 caracteres, al menos una letra y un número, máximo 72 bytes.
 * El límite de 72 bytes existe porque bcrypt ignora todo lo que exceda ese largo.
 * @param {string} contrasena
 * @returns {{ valida: boolean, mensaje: string | null }}
 */
export function validarContrasena(contrasena) {
  const texto = contrasena ?? '';

  if (Buffer.byteLength(texto, 'utf8') > 72) {
    return { valida: false, mensaje: 'La contraseña no puede superar los 72 caracteres' };
  }

  if (texto.length < 8) {
    return { valida: false, mensaje: 'La contraseña debe tener al menos 8 caracteres, con una letra y un número' };
  }

  const tieneLetra = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(texto);
  const tieneNumero = /\d/.test(texto);

  if (!tieneLetra || !tieneNumero) {
    return { valida: false, mensaje: 'La contraseña debe tener al menos 8 caracteres, con una letra y un número' };
  }

  return { valida: true, mensaje: null };
}