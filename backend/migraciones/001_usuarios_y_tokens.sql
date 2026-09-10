-- LET-4 · Tablas del modulo de autenticacion.
-- DDL cerrado por el equipo. No agregar columnas de rol ni de estado: eso lo
-- hace el modulo 2.

CREATE TABLE usuarios (
  id                BIGSERIAL PRIMARY KEY,
  nombre            VARCHAR(80)  NOT NULL,
  email             VARCHAR(254) NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(60)  NOT NULL,
  creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tokens_recuperacion (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   BIGINT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expira_en    TIMESTAMPTZ NOT NULL,
  usado_en     TIMESTAMPTZ,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tokens_usuario ON tokens_recuperacion (usuario_id);
