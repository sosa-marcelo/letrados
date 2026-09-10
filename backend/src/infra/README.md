# Capa `infra`

Detalles tecnicos que el resto del codigo usa sin conocer por dentro.

**Va aca:**
- `config.js` — lee y valida las variables de entorno.
- `bd.js` — pool de conexiones a PostgreSQL.
- `registrador.js` — logging con redaccion de datos sensibles (RNF-01).
- mas adelante: hash de contrasenas (bcrypt), firma de JWT, envio de correo.

**No va aca:** reglas de negocio, SQL de tablas concretas, rutas.

El correo se expone detras de una interfaz con dos implementaciones (`consola`
en desarrollo, proveedor real en produccion), elegidas por `CORREO_PROVEEDOR`.
