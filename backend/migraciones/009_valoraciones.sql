-- LET-162 · Valoraciones (epica LET-116, modulo 5, RF-25 a RF-27).
--
-- Despues de completar un intercambio, cada parte valora una sola vez a la
-- otra: puntaje entero de 1 a 5 y comentario opcional. La reputacion (RF-26)
-- se calcula al leer, con el promedio y la cantidad de las recibidas.
--
-- El UNIQUE por (solicitud, autor) sostiene «una sola vez» tambien ante dos
-- envios simultaneos (CU-28 E1): el segundo choca. Nadie se valora a si mismo.

CREATE TABLE valoraciones (
  id            BIGSERIAL   PRIMARY KEY,
  solicitud_id  BIGINT      NOT NULL REFERENCES solicitudes(id),
  autor_id      BIGINT      NOT NULL REFERENCES usuarios(id),
  valorado_id   BIGINT      NOT NULL REFERENCES usuarios(id),
  puntaje       SMALLINT    NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario    VARCHAR(500),
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT una_valoracion_por_parte UNIQUE (solicitud_id, autor_id),
  CONSTRAINT no_autovaloracion CHECK (autor_id <> valorado_id)
);

CREATE INDEX idx_valoraciones_valorado ON valoraciones (valorado_id);
