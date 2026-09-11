import bcrypt from 'bcrypt';

/** Cuanto trabajo cuesta calcular un hash. Lo fija el RNF-01. */
const COSTE = 12;

/**
 * Cifra una contrasena. Devuelve el texto de 60 caracteres que se guarda
 * en la columna `contrasena_hash`.
 */
export async function hashear(contrasena) {
  return bcrypt.hash(contrasena, COSTE);
}

/** Dice si la contrasena se corresponde con el hash guardado. */
export async function verificar(contrasena, hash) {
  return bcrypt.compare(contrasena, hash);
}