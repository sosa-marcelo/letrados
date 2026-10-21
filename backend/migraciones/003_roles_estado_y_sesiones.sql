-- LET-45 · Roles, estado de cuenta y sesiones revocables (modulo 2).
--
-- `rol` y `estado` con DEFAULT: RF-06 (toda cuenta nueva es `usuario`) lo
-- cumple la base, no depende de que el registro se acuerde de ponerlo.
--
-- `sesiones`: cada token lleva un `jti` que existe como fila aca. Cerrar
-- sesion, cambiar la contrasena, bloquear o dar de baja una cuenta se reduce a
-- escribir `revocada_en` en una o varias filas (DISENIO-GENERAL §3.2).

ALTER TABLE usuarios
  ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'usuario'
    CHECK (rol IN ('usuario', 'administrador')),
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'bloqueada', 'eliminada')),
  ADD COLUMN bloqueada_en TIMESTAMPTZ,
  ADD COLUMN eliminada_en TIMESTAMPTZ;

CREATE TABLE sesiones (
  jti          UUID        PRIMARY KEY,
  usuario_id   BIGINT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emitida_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en    TIMESTAMPTZ NOT NULL,
  revocada_en  TIMESTAMPTZ
);

CREATE INDEX idx_sesiones_usuario_vigentes
  ON sesiones (usuario_id) WHERE revocada_en IS NULL;
