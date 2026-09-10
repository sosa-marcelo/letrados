# Diseño — LET-6 y LET-20 (Entorno y base del frontend)

Épica: LET-33 · Entorno y base del proyecto.
Autor: sesión front-letrados. Fecha: 2026-09-10.

Este documento cierra las decisiones antes de escribir código. Si durante el
desarrollo aparece una decisión nueva, se documenta acá antes de seguir.

---

## 1. Problema

El monorepo ya tiene el esqueleto (workspaces `frontend` y `backend`) pero el
workspace `frontend` no tiene aplicación: sus scripts son placeholders. Hay que:

- **LET-6** — Inicializar Vite + React con enrutador y cliente HTTP. Solo el
  andamio: las cinco rutas existen y navegan, cada una con un componente de
  relleno. No se construyen las pantallas reales (son de otras épicas).
- **LET-20** — Los cuatro componentes base (Tarjeta, Campo, Pastilla, Lema) con
  los que las otras épicas arman las seis pantallas del módulo, más una página
  de muestra desechable.

Restricciones de contexto:
- Solo se toca `frontend/**`. No se toca `backend/**` ni el `package.json` raíz.
- Stack cerrado: JavaScript (nada de TypeScript), React, Vite, react-router-dom,
  `fetch` envuelto a mano (nada de axios), CSS plano con variables (nada de
  Tailwind ni CSS-in-JS ni librería de componentes).
- Nombres y comentarios en español.
- El backend todavía no existe: las rutas `/api/*` responden 501 por ahora.

---

## 2. Análisis y alternativas

### 2.1 Cómo inicializar Vite en un workspace existente

`npm create vite` quiere generar su propio `package.json` y su estructura en un
directorio; acá ya hay un `package.json` de workspace y una estructura definida
(`src/paginas`, `src/componentes`, `src/servicios`, `src/contexto`).

**Decisión:** crear los archivos a mano (config, `index.html`, `main.jsx`) y
agregar las dependencias a `frontend/package.json`, sin correr el scaffolder.
Así se respeta la estructura del README y no se pisan carpetas.

### 2.2 Versiones

Se fija la línea estable vigente:

| Paquete | Versión | Rol |
|---|---|---|
| `react` / `react-dom` | `^19` | UI |
| `react-router-dom` | `^7` | enrutador |
| `vite` | `^7` | bundler / dev server |
| `@vitejs/plugin-react` | `^5` | React en Vite |

Vitest **no** se agrega acá: es LET-5 (otra tarea). Ver decisión 2.7.

### 2.3 Forma del enrutador

Alternativas: `<BrowserRouter>` + `<Routes>` vs. `createBrowserRouter` +
`<RouterProvider>`.

**Decisión:** `createBrowserRouter` + `<RouterProvider>` (API de datos de
react-router 7, la recomendada). Rutas planas, sin layout compartido todavía
—el layout con orbes y lema lo define cada pantalla en su épica—.

### 2.4 Rutas

| Ruta | Componente (relleno) | Protegida | La construye |
|---|---|---|---|
| `/login` | `paginas/Login` | no | Inicio y cierre de sesión |
| `/registro` | `paginas/Registro` | no | Registro de cuenta |
| `/recuperar` | `paginas/Recuperar` | no | Recuperación |
| `/recuperar/:token` | `paginas/ContrasenaNueva` | no | Recuperación |
| `/` | `paginas/Home` | **sí** | Inicio y cierre de sesión |
| `/muestra` | `paginas/Muestra` | no | (desechable, LET-20) |
| `*` | `paginas/NoEncontrada` | no | — |

`/muestra` y `NoEncontrada` no están en la tabla del ticket pero no son
pantallas del producto: `/muestra` es el criterio de "Listo cuando" de LET-20 y
`*` evita una pantalla en blanco. Se documentan acá como añadidos del andamio.

### 2.5 "Home protegida" sin módulo de sesión

El contexto de sesión completo (`contexto/`) es de la épica "Inicio y cierre de
sesión", no de esta. Pero LET-6 pide que `/` esté protegida.

**Decisión:** `componentes/RutaProtegida.jsx` mínimo: si `leerToken()` devuelve
algo, renderiza los hijos; si no, `<Navigate to="/login" replace>`. Lee el token
directo de `servicios/token.js`. `contexto/` queda vacío (su `.gitkeep`) para la
otra épica. No se arma provider ni `useSesion` acá.

### 2.6 Cliente HTTP (`servicios/`)

**`servicios/token.js`** — envoltorio de `localStorage`, clave
`letrados.token`. `leerToken()`, `guardarToken(t)`, `borrarToken()`. Todo con
`try/catch` (localStorage puede tirar en modo privado). Es la única fuente del
token; `contexto/` construirá encima en su épica.

**`servicios/cliente.js`** — envoltorio de `fetch`:

- `solicitar(ruta, { metodo, cuerpo, cabeceras })`.
- URL: si `ruta` ya empieza con `/api` se usa tal cual; si no, se le antepone
  `/api`. Siempre relativa (en prod Express sirve API y estáticos en el mismo
  origen; en dev el proxy de Vite manda `/api` → `localhost:3000`).
- Si hay token en `localStorage`, agrega `Authorization: Bearer <token>`.
- Si `cuerpo` está definido: `Content-Type: application/json` y
  `JSON.stringify`. Siempre `Accept: application/json`.
- Respuesta: si el `content-type` es JSON se parsea; si no, `null`.
- Error de red (fetch rechaza) → `ErrorApi` con `codigo: 'SIN_RED'`.
- Respuesta no OK → `ErrorApi`. Si el cuerpo trae
  `{ error: { codigo, mensaje, detalles } }` se usan esos campos; si no,
  `codigo: 'HTTP_<status>'` y un mensaje genérico por rango de estado (incluye
  el 501 "El servidor todavía no implementa esto").
- `ErrorApi extends Error` con `.codigo`, `.mensaje`, `.detalles`, `.estado`.
- Atajos: `obtener(ruta)`, `enviar(ruta, cuerpo)`, `actualizar(ruta, cuerpo)`,
  `eliminar(ruta)` → GET/POST/PUT/DELETE.

Forma de error de la API (según el brief):

```json
{ "error": { "codigo": "EMAIL_DUPLICADO", "mensaje": "Ya existe una cuenta con ese correo", "detalles": [] } }
```

### 2.7 El script `test`

El ticket dice "reemplazar `dev`, `build`, `test`". Pero configurar Vitest es
LET-5, que no está asignada a esta sesión y todavía no existe.

**Decisión:** `dev` y `build` quedan reales (Vite). `test` queda como
placeholder que sale 0 y apunta a LET-5, para no romper `npm test` en la raíz
(que corre `--workspaces --if-present` y CONTRIBUTING exige en verde antes de
mergear). **Se avisa al integrador** por si prefiere otra cosa.

---

## 3. LET-20 — Componentes base

### 3.1 El color pleno como parámetro

El brief: "El color pleno del paso tiene que ser un parámetro, no algo fijo
dentro del componente". Cada pantalla de las otras épicas pasa su color.

**Decisión:** cada componente recibe `pleno` y (opcional) `complementario` como
strings de color CSS y los publica como custom properties en su elemento raíz:
`style={{ '--pleno': pleno, '--complementario': complementario }}`. Los `.css`
referencian `var(--pleno)` / `var(--complementario)`. Si no se pasa
`complementario`, se deriva con `estilos/pleno.js` (`complementarioDe`):
verde↔naranja, y tinta→naranja.

Mapa de pasos (de la hoja de sistema, para que las épicas lo usen):

| Paso | pleno |
|---|---|
| entrar · enlace enviado · home | verde |
| crear cuenta · contraseña nueva | naranja |
| recuperar | tinta |

### 3.2 Los cuatro componentes

Valores exactos de la tabla del brief y de las maquetas `Pleno*.dc.html`. No se
redondea a grilla de 8.

**`Tarjeta`** (`componentes/Tarjeta.jsx` + `.css`)
- props: `titulo?`, `children`, `className?`, `...resto`.
- fondo `--crema`, borde `2px solid --tinta`, radio `16px`, sombra
  `9px 9px 0 var(--tinta)` (`6px 6px 0` en móvil), ancho `424px`
  (`max-width`, baja a 100% en móvil), relleno `30px` (`20px` en móvil).
- si hay `titulo`, lo renderiza en un `<h1>` (Bricolage 800, 28/1.04).

**`Campo`** (`componentes/Campo.jsx` + `.css`)
- props: `id`, `etiqueta`, `tipo='text'`, `valor`, `alCambiar`, `pista?`,
  `error?`, `...resto`.
- estructura: `<label>` + `<input>` + `<p class="pista">` + `<p role="alert">`
  con el error.
- input: fondo `--hundido`, sin borde, radio `10px`, padding `13px 14px`,
  `box-shadow: inset 0 2px 0 rgba(20,20,20,.09)`, alto de control `48px`.
- foco de teclado: `outline: 3px solid var(--complementario)`,
  `outline-offset: 2px`. Visible con Tab.
- error: `box-shadow: inset 0 0 0 2px var(--rojo)`, y el `<p role="alert">`
  visible. El `input` toma `aria-invalid` y `aria-describedby`.
- estados cubiertos: reposo, foco, error.

**`Pastilla`** (`componentes/Pastilla.jsx` + `.css`) — el botón
- props: `children`, `estado='normal'` (`'normal' | 'cargando' | 'exito'`),
  `pleno?`, `tipo='button'`, `...resto`.
- base: fondo `var(--pleno, var(--verde))`, texto `--crema`, borde
  `2px solid --tinta`, radio `999px`, alto `48px`, Bricolage 800.
- `cargando`: pierde el color de fondo (pasa a `--hundido`), muestra un aro que
  gira (`border-top-color: var(--naranja)`), `disabled`, `aria-busy`. **Mismas
  dimensiones**: el contenido normal se oculta con `visibility:hidden` y el aro
  va en `position:absolute` centrado, así no salta nada.
- `exito`: fondo `--verde`, tilde (SVG) + texto, `disabled`.

**`Lema`** (`componentes/Lema.jsx` + `.css`) — el titular grande
- props: `texto` (con la palabra a resaltar entre asteriscos, p. ej.
  `"Un libro *quieto* no le sirve a nadie."`), `pleno?`, `...resto`.
- Bricolage 800, `58/0.94` (`30/0.98` a ≤360px), `letter-spacing: -.04em`.
- la parte entre asteriscos va en un `<em>` (sin itálica) con
  `color: var(--complementario)`.

### 3.3 Página de muestra

`paginas/Muestra.jsx` en `/muestra`. Fondo de color pleno, una `Tarjeta` con los
cuatro componentes en sus estados (Campo reposo/foco/error, Pastilla
normal/cargando/éxito, Lema al costado), y un aviso de que la borra la épica de
la home. Sin lógica de negocio: los estados se togglean con `useState` local
para poder verlos.

---

## 4. Otros archivos

- `frontend/index.html` — `<div id="root">`, `<link>` a Google Fonts (Bricolage
  Grotesque + Public Sans), `lang="es"`, título "Letrados".
- `frontend/vite.config.js` — plugin React, `server.port = 5173`,
  `server.proxy['/api'] = { target: 'http://localhost:3000', changeOrigin: true }`.
- `src/main.jsx` — monta `<RouterProvider>`; importa `estilos/tokens.css` y
  `estilos/base.css`.
- `src/estilos/tokens.css` — todos los tokens (paleta, tipografía, espaciado,
  radios, borde, sombra, alto de control) como custom properties en `:root`.
- `src/estilos/base.css` — reset (`*{box-sizing}`), `body` con la pila de
  fuentes real (`'Public Sans', system-ui, Arial, sans-serif`), color y fondo.
- `src/App.jsx` — arma el `createBrowserRouter` con las rutas de 2.4.
- `src/componentes/Relleno.jsx` — placeholder reutilizable (nombre de la
  pantalla + qué épica la construye). Lo usan las cinco páginas de relleno.

---

## 5. Checklist

### LET-6 — rama `LET-6-inicializar-react-con-enrutador`
- [x] Documento de diseño
- [x] `npm install` base y lectura de README/CONTRIBUTING
- [x] `frontend/package.json`: deps + scripts `dev`/`build` reales, `test` placeholder
- [x] `frontend/vite.config.js` con proxy `/api`
- [x] `frontend/index.html` + fuentes
- [x] `src/estilos/tokens.css` y `base.css`
- [x] `src/main.jsx` y `src/App.jsx` (router)
- [x] `src/componentes/Relleno.jsx` y `RutaProtegida.jsx`
- [x] `src/paginas/`: Login, Registro, Recuperar, ContrasenaNueva, Home, NoEncontrada
- [x] `src/paginas/Muestra.jsx` (placeholder mínimo, se completa en LET-20)
- [x] `src/servicios/token.js`
- [x] `src/servicios/cliente.js`
- [x] `npm install` con deps nuevas
- [x] Probar `npm run dev` y navegar las cinco rutas + build (Chrome: las 5 rutas + `/muestra` + 404 renderizan sin errores de consola; `/` sin token redirige a `/login`; `:token` se captura)
- [x] Prueba manual del cliente HTTP con respuestas simuladas (8/8 casos: prefijo /api, token Bearer, JSON, forma de error, 501, sin red)
- [x] Commit LET-6

### LET-20 — rama `LET-20-componentes-base` (sale de LET-6)
- [ ] Crear rama
- [ ] `src/estilos/pleno.js` (`complementarioDe`)
- [ ] `componentes/Tarjeta.jsx` + `.css`
- [ ] `componentes/Campo.jsx` + `.css`
- [ ] `componentes/Pastilla.jsx` + `.css`
- [ ] `componentes/Lema.jsx` + `.css`
- [ ] `paginas/Muestra.jsx` completa en `/muestra`
- [ ] Probar en el navegador: reposo, foco (Tab), error, cargando, éxito
- [ ] Commit LET-20
- [ ] Reportar al integrador
