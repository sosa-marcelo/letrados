# Capa `domain`

Reglas de negocio. Orquesta la capa `data` e `infra` (hash, jwt, correo).

**No sabe que existe HTTP:** no recibe `req`, no devuelve `res`, no conoce
codigos de estado. Cuando algo sale mal lanza un `ErrorDominio` (ver
`errores.js`) con un `codigo` y un `estado`, y es la capa `api` la que lo
convierte en respuesta.

**Va aca:** validaciones de negocio, decisiones, coordinacion entre `data` e
`infra`.

**No va aca:** SQL, `res.status(...)`, lectura de headers.

Las funciones exportadas llevan JSDoc. El umbral de cobertura del proyecto
(70%, RNF-06) se mide sobre esta carpeta.
