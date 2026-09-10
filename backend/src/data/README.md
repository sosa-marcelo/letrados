# Capa `data`

Solo SQL. Cada funcion arma una consulta parametrizada, la ejecuta y devuelve
filas planas.

**Reglas duras:**
- Consultas siempre parametrizadas (`$1, $2, ...`). Nunca concatenar valores.
- Cero reglas de negocio: no decide, no valida de negocio, no lanza errores de
  dominio. Si no encuentra algo, devuelve `null` o `[]`.
- No conoce HTTP.

**Va aca:** `usuarios.js`, `tokens.js`, futuras tablas.

Las funciones exportadas llevan JSDoc y reciben un ejecutor de consultas
inyectable (por defecto el pool de `infra/bd.js`) para poder probarlas contra
`pg-mem`.
