-- LET-124 · Publicaciones y sus fotos (epica LET-113, RF-14 a RF-16).
--
-- Una publicacion ofrece UN ejemplar de un libro del catalogo. Un libro tiene
-- como maximo una publicacion vigente (`activa` o `reservada`): lo sostiene el
-- indice unico parcial, ademas de la regla del dominio.
--
--   activa     aparece en Explorar y se puede solicitar
--   reservada  tiene una solicitud aceptada (epica LET-114)
--   cerrada    el intercambio se completo (epica LET-114)
--   retirada   el dueño la retiro o se dio de baja
--
-- Los datos del libro no se copian: la publicacion los lee del catalogo.
--
-- Las fotos van en su propia tabla para que los listados nunca carguen la
-- imagen. El contenido es base64 en TEXT, no BYTEA: pg-mem (la base de las
-- pruebas) corrompe los bytes >= 0x80 de un bytea y no tiene encode/decode,
-- asi que con bytea las fotos no se podrian probar. Cuesta un 33 % mas de
-- espacio (2 MB de imagen, el tope de la API, son ~2,7 MB de texto).
--
-- Las claves foraneas a `libros` no tienen ON DELETE CASCADE: un libro con
-- historial se archiva, no se borra.

CREATE TABLE publicaciones (
  id          BIGSERIAL    PRIMARY KEY,
  libro_id    BIGINT       NOT NULL REFERENCES libros(id),
  usuario_id  BIGINT       NOT NULL REFERENCES usuarios(id),
  estado      VARCHAR(20)  NOT NULL DEFAULT 'activa'
              CHECK (estado IN ('activa', 'reservada', 'cerrada', 'retirada')),
  nota        VARCHAR(300),
  creada_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  cerrada_en  TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_publicacion_vigente_por_libro
  ON publicaciones (libro_id) WHERE estado IN ('activa', 'reservada');
CREATE INDEX idx_publicaciones_usuario ON publicaciones (usuario_id);

CREATE TABLE fotos_publicacion (
  publicacion_id BIGINT      PRIMARY KEY REFERENCES publicaciones(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  contenido      TEXT        NOT NULL,  -- la imagen en base64
  subida_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
