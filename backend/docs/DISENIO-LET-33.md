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
- `src/infra/config.js`: carga `.env` con el `--env-file` nativo de Node o
  `process.env` ya poblado. Valida las 6 variables obligatorias:
  `DATABASE_URL`, `JWT_SECRETO`, `JWT_VENCIMIENTO`, `CORREO_PROVEEDOR`,
  `CORREO_API_KEY`, `URL_FRONTEND`.
  - `CORREO_API_KEY` puede venir vacia si `CORREO_PROVEEDOR=consola` — se exige
    presente solo si el proveedor es real.
  - Si falta una: lanza un error al arrancar con el mensaje
    `Falta la variable de entorno: NOMBRE` y el proceso no sigue.
- `src/infra/bd.js`: pool de `pg`. `ssl: { rejectUnauthorized: false }` cuando la
  URL trae `sslmode=require` (Neon). Exporta `consultar(texto, parametros)` y
  `obtenerCliente()` para transacciones.
- Dependencia nueva: `pg`.
- El `.env.example` ya existe; se agrega la nota del endpoint `-pooler`.

### 3.3 Migraciones (LET-4)
- `backend/migraciones/001_usuarios_y_tokens.sql`: el DDL tal cual.
- `backend/migraciones/correr.js`: corredor propio, sin ORM ni libreria.
  - Crea la tabla `migraciones_aplicadas (nombre TEXT PRIMARY KEY, aplicada_en
    TIMESTAMPTZ NOT NULL DEFAULT now())` si no existe.
  - Lee los `.sql` de la carpeta ordenados por nombre, aplica los que no esten
    registrados, cada uno dentro de una transaccion, y los registra.
  - Idempotente: correrlo dos veces no hace nada la segunda.
- Se engancha a `npm run migrar` (reemplaza el `echo` provisorio).

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
- Pruebas con `pg-mem`. **Riesgo**: `pg-mem` puede no tragar `BIGSERIAL`,
  `TIMESTAMPTZ` o `now()` tal cual. Si no lo hace: se dejan las pruebas afectadas
  como `it.skip` con motivo, se avisa al integrador y se sigue. No se pelea con la
  herramienta ni se toca el DDL.

### 3.6 Manejador de errores (LET-17)
- `src/domain/errores.js`: clase `ErrorDominio extends Error` con `codigo`
  (string), `estado` (number HTTP) y `detalles` (array, default `[]`).
  Helpers: `noImplementado()`, `datosInvalidos(detalles)`, etc. — se agregan
  segun se necesiten.
- `src/api/middlewares/manejadorErrores.js`: ultimo middleware. Forma unica:
  ```json
  { "error": { "codigo": "...", "mensaje": "...", "detalles": [] } }
  ```
  - `ErrorDominio` -> usa su `codigo`/`estado`/`mensaje`/`detalles`.
  - Cualquier otro error -> 500 `ERROR_INTERNO`, mensaje generico. **Nunca**
    manda stack ni detalle interno al cliente.
  - Loguea con el `registrador`, que **redacta** `contrasena`, `contrasena_hash`,
    `token`, `authorization` (RNF-01).
- `src/api/middlewares/noEncontrado.js`: 404 `RECURSO_NO_ENCONTRADO` en JSON para
  rutas `/api/*` que no existen.
- `src/infra/registrador.js`: wrapper mínimo sobre `console` con redaccion.

### 3.7 Rutas de auth (LET-18)
- **Solo se congela el contrato.** Las reglas de negocio son de otras epicas.
- `src/api/rutas/auth.js` monta las 5 rutas. Cada controlador:
  1. valida la entrada (400 `DATOS_INVALIDOS` con `detalles`),
  2. llama a una funcion de `src/domain/auth.js`,
  3. da forma a la respuesta.
- `src/domain/auth.js`: 5 funciones (`registrar`, `iniciarSesion`, `usuarioActual`,
  `pedirRecuperacion`, `confirmarRecuperacion`) que hoy hacen
  `throw new ErrorDominio('NO_IMPLEMENTADO', 501, 'Aun no implementado')`.
- `src/api/middlewares/autenticar.js`: lee `Authorization: Bearer`, verifica el
  JWT (HS256, `JWT_SECRETO`), deja `req.usuario = { id }`. Si falta o es invalido:
  401 `SESION_INVALIDA`. Se usa en `GET /api/auth/yo`.
- Dependencia nueva: `jsonwebtoken`.
- Validaciones de entrada: helpers propios en `src/api/validacion.js` (sin libreria).
  - registro: `nombre` (1..80), `email` (formato + <=254), `contrasena` (>=8).
  - login: `email`, `contrasena` presentes.
  - recuperacion: `email` con formato.
  - recuperacion/confirmar: `token` presente, `contrasena` (>=8).
- Reglas de contenido que son seguridad, no estetica (no se "mejoran"):
  - login SIEMPRE `CREDENCIALES_INVALIDAS` / «Correo o contraseña incorrectos».
  - `POST /api/auth/recuperacion` SIEMPRE 200, mismo cuerpo:
    «Si el correo está registrado, te enviamos un enlace».

## 4. Codigos de error (formato unico)

| codigo | estado | cuando |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | validacion de entrada |
| `EMAIL_DUPLICADO` | 409 | registro con email ya usado |
| `CREDENCIALES_INVALIDAS` | 401 | login fallido (siempre este) |
| `SESION_INVALIDA` | 401 | Bearer ausente o invalido |
| `TOKEN_INVALIDO` | 400 | token de recuperacion malo/vencido/usado |
| `NO_IMPLEMENTADO` | 501 | funcion de dominio todavia sin implementar |
| `RECURSO_NO_ENCONTRADO` | 404 | ruta `/api/*` inexistente |
| `ERROR_INTERNO` | 500 | cualquier error no controlado |

## 5. Que se puede probar hoy y que no

- **Se prueba de verdad hoy**: arranque de Express, `/api/salud`, validacion de
  entrada de auth, respuestas 501, forma del error, fallo de config por variable
  faltante, corredor de migraciones y capa de datos contra `pg-mem` (si traga el
  DDL).
- **No se puede verificar hoy** (no hay Postgres, ni Docker, ni cadena de Neon):
  migracion real contra Neon, pool real, cualquier ida y vuelta a una base de
  verdad. Se reporta como "escrito, no ejecutado".

## 6. Dependencias que se agregan al backend

| Paquete | Para | Tarea |
|---|---|---|
| `pg` | pool de PostgreSQL | LET-3 |
| `vitest` | pruebas | LET-5 |
| `@vitest/coverage-v8` | cobertura | LET-5 |
| `pg-mem` | Postgres en memoria para pruebas de `data` | LET-5/LET-10 |
| `jsonwebtoken` | verificar el Bearer | LET-18 |

No se toca el `package.json` de la raiz ni `frontend/**`.
