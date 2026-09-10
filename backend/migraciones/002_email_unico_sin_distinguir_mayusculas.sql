-- LET-33 · Unicidad real del correo.
--
-- El UNIQUE de la migracion 001 distingue mayusculas, asi que `ana@x.com` y
-- `Ana@x.com` conviven como dos cuentas. La normalizacion a minusculas la hace
-- `domain`, pero alcanza con que un camino se la olvide para partir una cuenta
-- en dos, y ademas el login por la variante en mayusculas fallaria para alguien
-- que si tiene cuenta, que es justo lo que la respuesta generica intenta
-- ocultar.
--
-- Este indice pone el invariante en la base, donde no depende de la disciplina
-- de cada llamador. No cambia ninguna columna del DDL cerrado: solo agrega red.

CREATE UNIQUE INDEX idx_usuarios_email_unico ON usuarios (lower(email));
