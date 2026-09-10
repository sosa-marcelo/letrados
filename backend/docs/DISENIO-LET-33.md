# LET-33 · Entorno y base del proyecto (backend)

Documento de diseño. Se codea **guiándose por este documento**. Si aparece una
decisión nueva durante el desarrollo, se anota acá antes de seguir.

Fuente de los requisitos: mensaje de coordinacion de la sesion integradora
(letrados-c3) del 2026-09-10. Las "decisiones ya cerradas", el DDL, el formato de
error y el contrato de la API vienen de ahi y no se re-discuten.

---

## 1. Problema y alcance

Dejar el backend listo para que las epicas de reglas de negocio (LET-12 a LET-15)
solo tengan que rellenar funciones de `src/domain/`. Siete tareas:

| Ticket | Entrega |
|---|---|
| LET-2  | Express con las 4 capas, split app/servidor, `GET /api/salud` |
| LET-3  | Pool de PostgreSQL + modulo de configuracion que valida el `.env` |
| LET-4  | Migracion del DDL + corredor de migraciones propio |
| LET-5  | Vitest en el workspace del backend + cobertura, umbral 70% en dominio |
| LET-10 | Capa de datos de usuarios y tokens (solo SQL) |
| LET-17 | Manejador central de errores + clase de error de dominio |
| LET-18 | Rutas/controladores/validacion de las 5 rutas de auth (contrato congelado) |

## 2. Arquitectura de capas

```
api     rutas, controladores, middlewares. Traduce HTTP <-> dominio.
domain  reglas de negocio. NO conoce req/res ni codigos de estado.
data    solo SQL parametrizado. Cero reglas de negocio.
infra   pool de conexion, config, jwt, hash, correo, registrador.
```

Dependencias permitidas: `api -> domain -> data -> infra`. `api` puede tocar
`infra` para cosas de transporte (verificar el Bearer). `domain` nunca importa de
`api`.

## 3. Decisiones de implementacion

### 3.1 Servidor (LET-2)
- `src/app.js` exporta `crearApp()` que devuelve la instancia de Express **sin**
  escuchar en un puerto. Asi las pruebas la importan con supertest.
- `src/servidor.js` importa `crearApp()`, lee el puerto de `PORT` (default 3000) y
  hace `listen`. Ya esta referenciado en `backend/package.json`.
- Orden de montaje en `app.js`, en este orden exacto (un comentario lo explica):
  1. `express.json()`
  2. router de `/api` (incluye `/api/salud`)
  3. estaticos de `frontend/dist`
  4. comodin `GET *` -> `index.html`
  5. manejador 404 de `/api` (JSON, no HTML) — ver 3.6
  6. manejador central de errores (LET-17), siempre el ultimo
- En desarrollo `frontend/dist` no existe todavia: los pasos 3 y 4 se montan solo
  si la carpeta existe, para no romper el arranque.
- Cada capa deja un `README.md` breve (que va y que no va).

### 3.2 Configuracion y pool (LET-3)
- `src/infra/config.js`: no lee el archivo; se apoya en `process.env` ya poblado
  (`node --env-file=.env ...` o variables del hosting). Valida las variables
  obligatorias y las expone normalizadas via `construirConfig(entorno)` (exportada
  aparte para poder probarla con distintos entornos).
  - Obligatorias siempre (5): `DATABASE_URL`, `JWT_SECRETO`, `JWT_VENCIMIENTO`,
    `CORREO_PROVEEDOR`, `URL_FRONTEND`.
  - Si falta una: lanza al importarse con el mensaje
    `Falta la variable de entorno: NOMBRE` y el proceso no arranca.

  **Decision LET-3 (2026-09-10, confirmada por el integrador):** `CORREO_API_KEY`
  NO es obligatoria siempre. Se exige solo si `CORREO_PROVEEDOR !== 'consola'`.
  Motivo: pedir una credencial para un "proveedor" que solo escribe en stdout
  obligaria a poner un valor falso en `.env.example`, y eso entrena al equipo a
  rellenar credenciales con basura para que el proyecto arranque. Cuando el
  proveedor es real y falta la clave, el mensaje es
  `Falta la variable de entorno: CORREO_API_KEY`.
- `src/infra/bd.js`: pool de `pg`. `ssl: { rejectUnauthorized: false }` cuando la
  URL trae `sslmode=require` (Neon). Exporta `consultar(texto, parametros)` y
  `obtenerCliente()` para transacciones.
- Dependencia nueva: `pg`.
- El `.env.example` ya existe; se agrega la nota del endpoint `-pooler`.

### 3.3 Migraciones (LET-4)
- `backend/migraciones/001_usuarios_y_tokens.sql`: el DDL tal cual.
- `backend/migraciones/correr.js`: corredor propio, sin ORM ni libreria.
  - Crea la tabla `migraciones_aplicadas (nombre TEXT PRIMARY KEY, aplicada_en
    TIMESTAMPTZ NOT NULL DEFAULT now())` si no existe. Consulta
    `information_schema.tables` en vez de `CREATE TABLE IF NOT EXISTS`: es
    explicito y portable, y en Postgres se comporta igual. (El disparador fue un
    defecto de `pg-mem` en la 2da corrida, pero el resultado se sostiene por si
    mismo.)
  - Lee los `.sql` de la carpeta ordenados por nombre, aplica los que no esten
    registrados, cada uno dentro de una transaccion, y los registra.
  - Idempotente: correrlo dos veces no hace nada la segunda.
- Se engancha a `npm run migrar` (reemplaza el `echo` provisorio).
- **Deuda anotada:** el corredor no toma un `pg_advisory_lock`. Si dos personas
  corren `npm run migrar` a la vez contra la misma base, ambas pueden pasar el
  chequeo de `information_schema` y chocar. Para el tamano actual del equipo no
  se arregla ahora; se agrega un advisory lock al principio del corredor cuando
  haga falta.

**Principio de trabajo con `pg-mem` (fijado tras LET-4):** `pg-mem` es una
reimplementacion de Postgres en JavaScript, no el motor. Cuando no coincida con
Postgres, **el que se acomoda es la prueba, no el codigo de produccion**: se
saltea con un motivo escrito y se sigue. Nunca se reescribe una consulta valida
para que `pg-mem` la trague.

### 3.4 Vitest (LET-5)
- Dependencias nuevas: `vitest`, `@vitest/coverage-v8`, `pg-mem`.
- `backend/vitest.config.js`: entorno `node`, `include: ['pruebas/**/*.prueba.js']`,
  cobertura con proveedor `v8`. Umbral **solo** sobre `src/domain/**`:
  `thresholds: { 'src/domain/**': { lines: 70, functions: 70, branches: 70, statements: 70 } }`.
- Script `test` del backend: `vitest run --coverage`. El `dev` de test queda
  `vitest` (watch) opcional — no, se deja solo `test`.
- Las pruebas viven en `backend/pruebas/`, con sufijo `.prueba.js`, replicando la
  ruta de lo que prueban (`pruebas/data/usuarios.prueba.js`).

### 3.5 Capa de datos (LET-10)
- `src/data/usuarios.js` y `src/data/tokens.js`. Solo SQL parametrizado (`$1, $2`),
  nunca concatenacion. JSDoc en cada funcion exportada.
- Funciones:
  - `insertarUsuario({ nombre, email, contrasena_hash })` -> fila `{ id, nombre, email, creado_en }`
  - `buscarUsuarioPorEmail(email)` -> fila completa (incluye `contrasena_hash`) o `null`
  - `insertarToken({ usuario_id, token_hash, expira_en })` -> fila
  - `buscarTokenVigentePorHash(token_hash)` -> fila o `null`. Vigente =
    `expira_en > now() AND usado_en IS NULL`
  - `marcarTokenUsado(id)` -> fila actualizada
  - `invalidarTokensPendientesDeUsuario(usuario_id)` -> cantidad afectada
- Reciben un ejecutor de consultas inyectable (default: el pool) para poder pasar
  el cliente de `pg-mem` en las pruebas.
- Pruebas con `pg-mem`. Verificado en LET-4: `pg-mem` traga el DDL cerrado entero
  (`BIGSERIAL`, `TIMESTAMPTZ`, `now()`, `REFERENCES`, `UNIQUE`). Si alguna consulta
  puntual no le entra, se marca esa prueba como pendiente con motivo y se sigue;
  no se reescribe la consulta ni se toca el DDL (ver principio en 3.3).

### 3.6 Manejador de errores (LET-17)
- `src/domain/errores.js`: clase `ErrorDominio extends Error` con `codigo`
  (string), `estado` (number HTTP) y `detalles` (array, default `[]`). El texto
  para el usuario va en `error.message` (via `super(mensaje)`). Fabricas:
  `noImplementado()`, `datosInvalidos(detalles)`, `rutaNoEncontrada(mensaje)`.
- `src/api/middlewares/manejadorErrores.js` y `rutaNoEncontrada.js` viven **dentro
  del router de `/api`** (`api/index.js`), en este orden al final: rutas ->
  `rutaNoEncontrada` -> `manejadorErrores`. Estar dentro del router hace que el
  manejador solo aplique a `/api`: si falla algo sirviendo la SPA, no se devuelve
  JSON.
  - `rutaNoEncontrada`: cualquier `/api/...` sin match -> `next()` con un
    `ErrorDominio('RUTA_NO_ENCONTRADA', 404)`. Sin esto, el comodin de la SPA
    responde `index.html` con 200 a rutas de API mal escritas (bug encontrado al
    integrar LET-5 + LET-6).
  - `manejadorErrores`: forma unica
    `{ "error": { "codigo", "mensaje", "detalles": [] } }`.
    - `ErrorDominio` -> su `codigo`/`estado`/`message`/`detalles`.
    - Error del body-parser (`error.type === 'entity.parse.failed'`) -> se mapea a
      `ErrorDominio('JSON_INVALIDO', 400)`. Es culpa del cliente, no puede salir
      500; el mensaje no repite lo que mando el cliente. Esto exige que
      `express.json()` este **dentro** del router de `/api` (lo esta): si
      estuviera a nivel de app, el error de parseo saldria por el manejador por
      defecto de Express (HTML + volcado de pila) sin pasar por el nuestro.
    - Cualquier otro error -> 500 `ERROR_INTERNO`, mensaje generico. **Nunca**
      manda stack ni detalle interno al cliente.
    - Registra con el `registrador`: 500 por `error`, 4xx por `advertencia`.
      Solo `{ metodo, ruta, codigo, estado }` (+ el error para los 500, del lado
      del servidor).

  **REGLA (RNF-01), no detalle de implementacion: el cuerpo de la peticion
  (`req.body`) NO se registra nunca.** Ni redactado. Puede traer contrasenas o
  tokens, y la regla "no se loguea, punto" es la que no se rompe cuando alguien
  agrega un campo sensible nuevo dentro de seis meses. El `redactar` recursivo
  del `registrador` es para el resto del codigo, no una licencia para loguear el
  body.
- `src/infra/registrador.js`: wrapper sobre `console` que **redacta** en
  profundidad las claves sensibles (`contrasena*`, `contrasena_hash`, `token`,
  `token_hash`, `authorization`, `jwt`, `secreto`, ...) antes de escribir.
  `redactar(valor)` exportada aparte.
- **Guarda de uso unico en `data/tokens.js` (traida a LET-17):** `marcarTokenUsado`
  suma `AND usado_en IS NULL` al `UPDATE`. Lo convierte en un compare-and-swap:
  ante dos peticiones simultaneas con el mismo token, solo una recibe la fila, la
  otra recibe `null`. No es regla de negocio; es el mecanismo que hace aplicable
  el "un solo uso" que `domain` no puede garantizar entre dos consultas.

### 3.7 Rutas de auth (LET-18)
- **Solo se congela el contrato.** Las reglas de negocio son de otras epicas
  (LET-12 a LET-15). Cada epica siguiente rellena su funcion de dominio y no toca
  ni rutas ni controladores.
- `src/api/rutas/auth.js` monta las 5 rutas en un `Router`, montado en
  `api/index.js` despues de `express.json()` y de `rutasSalud`, antes de
  `rutaNoEncontrada`. Cada controlador:
  1. valida la entrada (`validar*` lanza `DATOS_INVALIDOS` 400 con `detalles`),
  2. `await` a una funcion de `src/domain/auth.js` (Express 5 propaga el rechazo
     al manejador; no hace falta try/catch),
  3. da forma a la respuesta con `vistaPublica(usuario)` = `{ id, nombre, email }`
     — el hash y `creado_en` nunca salen por aca.
- `src/domain/auth.js`: `registrar`, `iniciarSesion`, `usuarioActual`,
  `pedirRecuperacion`, `confirmarRecuperacion`. Hoy todas hacen
  `throw noImplementado('... (LET-XX)')` -> 501 `NO_IMPLEMENTADO`. Firmas y JSDoc
  ya definitivos.
- `src/api/middlewares/autenticar.js`: lee `Authorization: Bearer <token>`,
  `jwt.verify` con `algorithms: ['HS256']` y `obtenerConfig().jwtSecreto`, deja
  `req.usuario = { id: String(carga.sub) }`. Header ausente, esquema != Bearer,
  firma mala o token vencido -> 401 `SESION_INVALIDA`, sin distinguir el caso.
  Se usa solo en `GET /api/auth/yo`. Logout del lado del cliente, sin revocacion.
- Dependencia nueva: `jsonwebtoken`.
- Validaciones de entrada: helpers propios en `src/api/validacion.js` (sin
  libreria; son cuatro formularios simples). Cada `validar*` junta TODOS los
  errores en `detalles` (un `{ campo, mensaje }` por problema) y recien ahi lanza.
  - registro: `nombre` (obligatorio, <=80), `email` (formato + <=254),
    `contrasena` (>=8). Devuelve `{ nombre, email, contrasena }` con los textos
    recortados en los bordes.
  - login: `email` y `contrasena` presentes.
  - recuperacion: `email` con formato.
  - recuperacion/confirmar: `token` presente, `contrasena` (>=8).
- Reglas de contenido que son seguridad, no estetica (no se "mejoran"):
  - login SIEMPRE `CREDENCIALES_INVALIDAS` / «Correo o contraseña incorrectos»
    (lo fija `domain`, el controlador solo da forma).
  - `POST /api/auth/recuperacion` SIEMPRE 200, mismo cuerpo, exista o no la
    cuenta. `domain` (LET-14) NO debe lanzar por "correo inexistente". Durante el
    freeze la ruta responde 501 como el resto.

**Decisiones nuevas de LET-18:**
- **Claim del user id: `sub`.** `autenticar` lee el id de `carga.sub`. Quien
  implemente el login (LET-13) tiene que firmar el token con el id en `sub`. Si
  se prefiere otro claim, alinearlo ANTES de LET-13.
- **La validacion de entrada NO normaliza el correo a minusculas**, solo recorta
  espacios para validar el formato. La normalizacion semantica es regla de
  negocio y vive en `domain`; la base ya no depende de que la app se acuerde,
  gracias al indice unico sobre `lower(email)` (migracion 002). Si mas adelante
  se quiere defensa en profundidad, lowercasear tambien en `validacion.js` es
  barato.
- **Testeabilidad del middleware `autenticar`:** necesita `obtenerConfig()` con
  entorno cargado. `pruebas/apoyo/entorno.js` expone `prepararEntorno()` /
  `limpiarEntorno()` (setean `process.env` + `reiniciarConfig()`) y
  `JWT_SECRETO_PRUEBA` para firmar tokens de prueba. Se usa en un
  `beforeAll`/`afterAll`.
- Contrato fijado por `pruebas/api/auth.prueba.js`: por cada ruta, entrada
  invalida -> 400 `DATOS_INVALIDOS` con `detalles`; entrada valida -> 501
  `NO_IMPLEMENTADO`; `GET /api/auth/yo` sin/mal Bearer -> 401 `SESION_INVALIDA`,
  con Bearer valido -> pasa la sesion y llega al dominio (501).

## 4. Codigos de error (formato unico)

| codigo | estado | cuando |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | validacion de entrada |
| `EMAIL_DUPLICADO` | 409 | registro con email ya usado |
| `CREDENCIALES_INVALIDAS` | 401 | login fallido (siempre este) |
| `SESION_INVALIDA` | 401 | Bearer ausente o invalido |
| `TOKEN_INVALIDO` | 400 | token de recuperacion malo/vencido/usado |
| `NO_IMPLEMENTADO` | 501 | funcion de dominio todavia sin implementar |
| `RUTA_NO_ENCONTRADA` | 404 | ruta `/api/*` inexistente |
| `JSON_INVALIDO` | 400 | el cuerpo de la peticion no es JSON valido |
| `ERROR_INTERNO` | 500 | cualquier error no controlado |

## 5. Que se puede probar hoy y que no

- **Se prueba de verdad hoy**: arranque de Express, `/api/salud`, validacion de
  entrada de auth, respuestas 501, forma del error, fallo de config por variable
  faltante, logica del corredor de migraciones y capa de datos contra `pg-mem`.
- **No se puede verificar hoy** (no hay Postgres, ni Docker, ni cadena de Neon):
  migracion real contra Neon, pool real, cualquier ida y vuelta a una base de
  verdad. Se reporta como "escrito, no ejecutado".
- **Asterisco sobre `pg-mem` (LET-4/LET-10):** `pg-mem` es Postgres reimplementado
  en JavaScript, no el motor. Que la migracion corra y que las consultas de `data`
  pasen contra `pg-mem` da confianza en la forma del SQL, pero **no** cumple el
  «Listo cuando» de LET-4 («la migracion corre desde cero contra una base»). Ese
  paso queda pendiente: cuando llegue `DATABASE_URL`, hay que correr
  `npm run migrar` de verdad contra Neon y recien ahi darlo por verificado.

## 6. Dependencias que se agregan al backend

| Paquete | Para | Tarea |
|---|---|---|
| `pg` | pool de PostgreSQL | LET-3 |
| `vitest` | pruebas | LET-5 |
| `@vitest/coverage-v8` | cobertura | LET-5 |
| `pg-mem` | Postgres en memoria para pruebas de `data` | LET-5/LET-10 |
| `jsonwebtoken` | verificar el Bearer | LET-18 |

No se toca el `package.json` de la raiz ni `frontend/**`.
