-- LET-153 · Plazo, flagueo y reportes (epica LET-115, RF-22 a RF-24).
--
-- `parametros`: valores que se cambian sin desplegar. El plazo de confirmacion
-- de un intercambio aceptado (RF-22) vale 24 horas; para la demo se baja a
-- 10 segundos con un UPDATE (README).
--
-- `solicitudes` suma cuando y por que se flagueo (RF-23): una aceptada cuyo
-- plazo vencio sin las dos confirmaciones.
--
-- `reportes`: lo que cada parte cuenta de un intercambio flagueado (RF-24).
-- Se ven junto al intercambio en el panel de administracion.

CREATE TABLE parametros (
  clave          VARCHAR(60)  PRIMARY KEY,
  valor          VARCHAR(200) NOT NULL,
  actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO parametros (clave, valor) VALUES ('plazo_confirmacion_segundos', '86400');

ALTER TABLE solicitudes
  ADD COLUMN flagueada_en   TIMESTAMPTZ,
  ADD COLUMN motivo_flagueo VARCHAR(200);

CREATE TABLE reportes (
  id           BIGSERIAL     PRIMARY KEY,
  solicitud_id BIGINT        NOT NULL REFERENCES solicitudes(id),
  autor_id     BIGINT        NOT NULL REFERENCES usuarios(id),
  descripcion  VARCHAR(1000) NOT NULL,
  creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_reportes_solicitud ON reportes (solicitud_id);
