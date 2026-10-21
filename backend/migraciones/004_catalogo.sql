-- LET-42 · Catalogo de libros (modulo 3, RF-10 a RF-13).
--
-- Un libro es un titulo con una cantidad, no un ejemplar. `disponible` no se
-- guarda: es cantidad_total - cantidad_reservada (DISENIO-MODULO-3 §1).
--
-- `cantidad_total >= 0` y no `>= 1`: RF-10/RF-11 exigen >= 1 a lo que escribe
-- el usuario (se valida en la API), pero RF-21 descuenta un ejemplar al cerrar
-- un intercambio y el ultimo tiene que poder llegar a cero.
--
-- `reservada_no_supera_total` sostiene el invariante en la base, en cada UPDATE.

CREATE TABLE libros (
  id                 BIGSERIAL    PRIMARY KEY,
  usuario_id         BIGINT       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo             VARCHAR(200) NOT NULL,
  autor              VARCHAR(200) NOT NULL,
  cantidad_total     INTEGER      NOT NULL CHECK (cantidad_total >= 0),
  cantidad_reservada INTEGER      NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
  archivado_en       TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT reservada_no_supera_total CHECK (cantidad_reservada <= cantidad_total)
);

CREATE INDEX idx_libros_usuario ON libros (usuario_id) WHERE archivado_en IS NULL;
