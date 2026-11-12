-- LET-137 · Solicitudes e intercambios (epica LET-114, RF-17 a RF-21).
--
-- Una solicitud une dos libros: el solicitado (el de la publicacion) y el
-- ofrecido (uno del solicitante). Cuando el dueño la acepta se vuelve un
-- intercambio: solicitud e intercambio son la misma fila en distintos estados.
--
--   pendiente   el solicitante ofrecio un libro          (RF-17)
--   aceptada    el dueño acepto: reserva 1 + 1           (RF-19)
--   rechazada   el dueño la rechazo o acepto otra        (RF-19)
--   cancelada   una parte la cancelo                     (RF-20)
--   completada  confirmaron los dos: descuenta 1 + 1     (RF-21)
--   flagueada   vencio el plazo sin las dos confirmaciones (RF-23, LET-115)
--
-- Solo intercambio (RF-17 v1.0): `libro_ofrecido_id` es obligatorio.
-- Un solicitante tiene a lo sumo una solicitud pendiente por publicacion.
-- Una aceptada siempre tiene plazo de confirmacion (`vence_en`, RF-22).

CREATE TABLE solicitudes (
  id                         BIGSERIAL   PRIMARY KEY,
  publicacion_id             BIGINT      NOT NULL REFERENCES publicaciones(id),
  solicitante_id             BIGINT      NOT NULL REFERENCES usuarios(id),
  libro_ofrecido_id          BIGINT      NOT NULL REFERENCES libros(id),
  estado                     VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada', 'completada', 'flagueada')),
  aceptada_en                TIMESTAMPTZ,
  vence_en                   TIMESTAMPTZ,
  confirmada_propietario_en  TIMESTAMPTZ,
  confirmada_solicitante_en  TIMESTAMPTZ,
  cancelada_por              BIGINT      REFERENCES usuarios(id),
  cerrada_en                 TIMESTAMPTZ,
  creada_en                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aceptada_con_vencimiento CHECK (estado <> 'aceptada' OR vence_en IS NOT NULL)
);

CREATE UNIQUE INDEX uq_solicitud_pendiente
  ON solicitudes (publicacion_id, solicitante_id) WHERE estado = 'pendiente';
CREATE INDEX idx_solicitudes_solicitante    ON solicitudes (solicitante_id);
CREATE INDEX idx_solicitudes_publicacion    ON solicitudes (publicacion_id);
CREATE INDEX idx_solicitudes_libro_ofrecido ON solicitudes (libro_ofrecido_id);
