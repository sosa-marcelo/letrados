# Capa `api`

Traduce HTTP a llamadas de dominio y vuelta. Es la unica capa que conoce
`req`, `res`, codigos de estado, headers y rutas.

**Va aca:** routers, controladores, middlewares (autenticacion, manejo de
errores, 404), validacion de la entrada.

**No va aca:** reglas de negocio (eso es `domain`), SQL (eso es `data`).

Un controlador: valida la entrada, llama a una funcion de `domain`, le da forma a
la respuesta. Nada mas.
