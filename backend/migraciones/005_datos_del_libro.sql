-- LET-118 · Datos opcionales del libro (epica LET-112, RF-10 y RF-11 v1.1).
--
-- Devolucion de la presentacion del sprint 2: el libro suma editorial, año de
-- publicacion, edicion, ISBN, estado de conservacion y una descripcion.
--
-- Todas las columnas admiten NULL: los libros ya cargados no tienen estos
-- datos y no se tocan. Las reglas finas (año <= año actual, formato del ISBN,
-- largos recortados) las valida la API; la base solo sostiene lo que no
-- depende del reloj ni del formato de entrada.
--
-- Los CHECK dicen `IS NULL OR ...` aunque en PostgreSQL sobra (un CHECK que da
-- NULL se acepta): pg-mem, la base en memoria de las pruebas, lo trata como
-- violado. Con el `IS NULL` explicito las dos bases se comportan igual.

ALTER TABLE libros
  ADD COLUMN editorial           VARCHAR(120),
  ADD COLUMN anio_publicacion    SMALLINT
    CHECK (anio_publicacion IS NULL OR anio_publicacion BETWEEN 1450 AND 2100),
  ADD COLUMN edicion             VARCHAR(60),
  ADD COLUMN isbn                VARCHAR(13),
  ADD COLUMN estado_conservacion VARCHAR(20)
    CHECK (estado_conservacion IS NULL
           OR estado_conservacion IN ('nuevo', 'muy_bueno', 'bueno', 'gastado')),
  ADD COLUMN descripcion         VARCHAR(500);
