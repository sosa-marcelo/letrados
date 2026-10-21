# Letrados · Documentación del backend

Documentación generada automáticamente con [JSDoc](https://jsdoc.app) a partir de
los comentarios del código de `backend/src/`.

El backend está organizado en cuatro capas:

- **api** — rutas HTTP, validación de entrada y middlewares (`autenticar`, `exigirRol`).
- **domain** — reglas de negocio. No conoce HTTP: recibe datos planos y lanza `ErrorDominio`.
- **data** — sólo SQL, una función por consulta.
- **infra** — base de datos, transacciones, JWT, hash, correo y configuración.

Para regenerarla: `npm run docs` (desde la raíz o desde `backend/`). La salida queda en
`frontend/public/documentacion/` y se publica junto con la aplicación en `/documentacion/`.
